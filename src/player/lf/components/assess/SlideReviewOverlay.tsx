import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Monitor, AlignLeft } from 'lucide-react';
import { SlidePreview } from '../../types/lesson';
import { SlideRenderConfig } from '../../types/slideRender';
import { SlideViewer } from '../preview/SlideViewer';
import { MobileSlideView } from './MobileSlideView';
import { useIsPhone } from '../../hooks/useIsPhone';
import { loadZoom, saveZoom, clampZoom, ZOOM_STEP, ZOOM_MIN, ZOOM_MAX } from '../../hooks/usePinchZoom';

const VIEW_MODE_KEY = 'hintViewMode';

function loadViewMode(isPhone: boolean): 'reading' | 'slide' {
  try {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    if (saved === 'reading' || saved === 'slide') return saved;
  } catch { /* storage unavailable */ }
  // Phones default to the readable reflowing view; desktop/tablet keep slides
  return isPhone ? 'reading' : 'slide';
}

interface SlideReviewOverlayProps {
  slides: SlidePreview[];
  /** Arabic deck (index-parallel with slides); shown by DEFAULT when present */
  slidesAr?: SlidePreview[];
  renderConfig: SlideRenderConfig;
  initialIndex: number;
  onClose: () => void;
}

/**
 * Fullscreen slide browser for the student assessment page — lets students
 * look back at the teaching slides while answering ("open book"). Static
 * render only: no audio, no reveal timings, everything visible.
 * Defaults to the Arabic deck when one exists (students' L1), with a toggle
 * back to the English slides.
 */
export function SlideReviewOverlay({ slides, slidesAr, renderConfig, initialIndex, onClose }: SlideReviewOverlayProps) {
  // Only trust the Arabic deck when it's index-parallel with the English one
  const hasArabic = !!slidesAr && slidesAr.length === slides.length && slides.length > 0;
  const [language, setLanguage] = useState<'en' | 'ar'>(hasArabic ? 'ar' : 'en');
  const [index, setIndex] = useState(Math.max(0, Math.min(initialIndex, slides.length - 1)));
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Phones get the reflowing reading view; desktop/tablet keep the real slide.
  // Either can override, and the choice sticks.
  const isPhone = useIsPhone();
  const [viewMode, setViewMode] = useState<'reading' | 'slide'>(() => loadViewMode(isPhone));
  const [fontSize, setFontSize] = useState<number>(loadZoom);

  useEffect(() => { saveZoom(fontSize); }, [fontSize]);

  const toggleViewMode = () => {
    setViewMode(m => {
      const next = m === 'reading' ? 'slide' : 'reading';
      try { localStorage.setItem(VIEW_MODE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  };

  const activeSlides = language === 'ar' && hasArabic ? slidesAr! : slides;

  const goPrev = useCallback(() => setIndex(i => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setIndex(i => Math.min(slides.length - 1, i + 1)), [slides.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goPrev, goNext]);

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

  const slide = activeSlides[index];
  if (!slide) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
        <span className="text-sm font-medium text-slate-300">
          Slide {index + 1} / {activeSlides.length}
        </span>
        <div className="flex items-center gap-2">
          {viewMode === 'reading' && (
            <span className="flex items-center rounded-lg bg-white/10 overflow-hidden">
              <button
                onClick={() => setFontSize(s => clampZoom(s - ZOOM_STEP))}
                disabled={fontSize <= ZOOM_MIN}
                className="px-2.5 py-1.5 text-sm font-bold hover:bg-white/10 disabled:text-slate-500"
                aria-label="Smaller text"
              >
                A−
              </button>
              <button
                onClick={() => setFontSize(s => clampZoom(s + ZOOM_STEP))}
                disabled={fontSize >= ZOOM_MAX}
                className="px-2.5 py-1.5 text-base font-bold hover:bg-white/10 disabled:text-slate-500"
                aria-label="Larger text"
              >
                A+
              </button>
            </span>
          )}
          <button
            onClick={toggleViewMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
            title={viewMode === 'reading' ? 'Show the original slide' : 'Show readable text'}
          >
            {viewMode === 'reading' ? <><Monitor className="w-4 h-4" /> Slide</> : <><AlignLeft className="w-4 h-4" /> Text</>}
          </button>
          {hasArabic && (
            <button
              onClick={() => setLanguage(l => l === 'ar' ? 'en' : 'ar')}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
            >
              {language === 'ar' ? 'English' : 'العربية'}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
          >
            <X className="w-4 h-4" /> Back to quiz
          </button>
        </div>
      </div>

      {/* Body: readable reflowing text (phones) or the real slide (desktop/tablet) */}
      {viewMode === 'reading' ? (
        <div className="flex-1 relative overflow-hidden">
          <MobileSlideView
            slide={slide}
            renderConfig={renderConfig}
            fontSize={fontSize}
            setFontSize={setFontSize}
            rtl={language === 'ar'}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center px-2 overflow-hidden">
          <div className="w-full max-w-3xl">
            <SlideViewer slide={slide} renderConfig={renderConfig} />
          </div>
        </div>
      )}

      {/* Nav */}
      <div className="flex items-center justify-center gap-6 py-4 shrink-0">
        <button
          onClick={goPrev}
          disabled={index === 0}
          className={`p-3 rounded-full ${index === 0 ? 'bg-white/5 text-slate-600' : 'bg-white/10 text-white active:bg-white/20'}`}
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="text-xs text-slate-400">swipe or tap arrows</span>
        <button
          onClick={goNext}
          disabled={index === slides.length - 1}
          className={`p-3 rounded-full ${index === slides.length - 1 ? 'bg-white/5 text-slate-600' : 'bg-white/10 text-white active:bg-white/20'}`}
          aria-label="Next slide"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
