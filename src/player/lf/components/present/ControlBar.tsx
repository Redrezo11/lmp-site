import React from 'react';
import { ChevronLeft, ChevronRight, Maximize, Minimize, Grid3X3, Volume2, Play, Pause, RotateCcw, ListVideo } from 'lucide-react';

interface ControlBarProps {
  current: number;
  total: number;
  onPrev: (e?: React.MouseEvent) => void;
  onNext: (e?: React.MouseEvent) => void;
  onFullscreen: () => void;
  onGrid: () => void;
  isFullscreen: boolean;
  visible: boolean;
  // Audio — "This slide": plays only the current slide's narration
  hasAudio?: boolean;
  isAudioPlaying?: boolean;
  onToggleAudio?: () => void;
  /** The current slide's narration finished on its own — offer Replay */
  slideFinished?: boolean;
  // Slideshow — "Play all": plays through every slide
  isSlideshowMode?: boolean;
  onToggleSlideshow?: () => void;
  // Generate audio (when no audio exists yet)
  onGenerateAudio?: () => void;
  isGeneratingAudio?: boolean;
  // Narration speed
  playbackRate?: number;
  onCyclePlaybackRate?: () => void;
  // Language
  language?: 'en' | 'ar';
  hasArabic?: boolean;
  onToggleLanguage?: () => void;
  onGenerateArabicSlides?: () => void;
  isGeneratingArabicSlides?: boolean;
  // Closed captions
  hasCaptions?: boolean;
  captionsOn?: boolean;
  onToggleCaptions?: () => void;
}

export function ControlBar({
  current, total, onPrev, onNext, onFullscreen, onGrid,
  isFullscreen, visible,
  hasAudio, isAudioPlaying, onToggleAudio, slideFinished,
  isSlideshowMode, onToggleSlideshow,
  playbackRate, onCyclePlaybackRate,
  onGenerateAudio, isGeneratingAudio,
  language, hasArabic, onToggleLanguage,
  onGenerateArabicSlides, isGeneratingArabicSlides,
  hasCaptions, captionsOn, onToggleCaptions,
}: ControlBarProps) {
  const progress = total > 1 ? ((current) / (total - 1)) * 100 : 100;

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      {/* Progress bar */}
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-white/60 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Control bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-sm">
        {/* Left: Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onPrev(e); }}
            disabled={current === 0}
            className="w-12 h-12 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10 disabled:text-white/20 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onNext(e); }}
            disabled={current === total - 1}
            className="w-12 h-12 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10 disabled:text-white/20 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Center: Counter + Audio + Slideshow */}
        <div className="flex items-center gap-3">
          {/* Generate audio button (shown when no audio exists) */}
          {onGenerateAudio && (
            <button
              onClick={(e) => { e.stopPropagation(); onGenerateAudio(); }}
              disabled={isGeneratingAudio}
              className="h-10 px-3 flex items-center gap-2 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-white/10 transition-colors text-xs font-medium"
              title="Generate audio for all slides"
            >
              {isGeneratingAudio ? (
                <>
                  <span className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin"></span>
                  Generating...
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  Generate Audio
                </>
              )}
            </button>
          )}

          {/* This slide — plays only the current slide and stops at its end.
              Hidden during "Play all", whose own button pauses the run. */}
          {onToggleAudio && !isSlideshowMode && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleAudio(); }}
              disabled={!hasAudio}
              className={`h-10 px-3 flex items-center gap-1.5 rounded-lg transition-colors text-sm font-medium ${
                isAudioPlaying
                  ? 'text-indigo-300 bg-white/10'
                  : hasAudio
                    ? 'text-white/85 hover:text-white hover:bg-white/10'
                    : 'text-white/25'
              }`}
              title={hasAudio ? 'Play just this slide (Space)' : 'No narration on this slide'}
            >
              {isAudioPlaying ? <Pause className="w-5 h-5" /> : slideFinished ? <RotateCcw className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              <span className="hidden sm:inline">{isAudioPlaying ? 'Pause' : slideFinished ? 'Replay' : 'This slide'}</span>
            </button>
          )}

          {/* Play all — the slideshow: every slide in order, advancing on its own */}
          {onToggleSlideshow && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSlideshow(); }}
              className={`h-10 px-3 flex items-center gap-1.5 rounded-lg transition-colors text-sm font-medium ${
                isSlideshowMode
                  ? 'text-emerald-300 bg-white/10'
                  : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
              title={isSlideshowMode ? 'Pause the slideshow (S)' : 'Play all slides in order (S)'}
            >
              {isSlideshowMode ? <Pause className="w-5 h-5" /> : <ListVideo className="w-5 h-5" />}
              <span className="hidden sm:inline">{isSlideshowMode ? 'Pause all' : 'Play all'}</span>
            </button>
          )}

          {/* Narration speed (cycles; per-language, English defaults to 0.9×) */}
          {onCyclePlaybackRate && playbackRate !== undefined && (
            <button
              onClick={(e) => { e.stopPropagation(); onCyclePlaybackRate(); }}
              className={`h-10 px-2.5 flex items-center rounded-lg transition-colors text-xs font-bold ${
                playbackRate !== 1 ? 'text-sky-300 bg-white/10' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              title="Narration speed"
            >
              {playbackRate}×
            </button>
          )}

          {/* Closed captions */}
          {hasCaptions && onToggleCaptions && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleCaptions(); }}
              className={`h-10 px-2.5 flex items-center rounded-lg transition-colors text-xs font-bold ${
                captionsOn ? 'text-sky-300 bg-white/10' : 'text-white/50 hover:text-white hover:bg-white/10'
              }`}
              title={captionsOn ? 'Hide captions (C)' : 'Show captions (C)'}
              aria-pressed={!!captionsOn}
            >
              <span className={`px-1 border rounded ${captionsOn ? 'border-sky-300' : 'border-white/40 line-through'}`}>CC</span>
            </button>
          )}

          {/* Counter */}
          <div className="text-white/70 text-sm font-medium select-none min-w-[60px] text-center">
            {current + 1} / {total}
          </div>

          {/* Language toggle / Generate Arabic */}
          {hasArabic && onToggleLanguage ? (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleLanguage(); }}
              className="h-10 px-3 flex items-center gap-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors text-xs font-bold"
              title="Toggle language (L)"
            >
              {language === 'ar' ? 'AR' : 'EN'}
            </button>
          ) : onGenerateArabicSlides ? (
            <button
              onClick={(e) => { e.stopPropagation(); onGenerateArabicSlides(); }}
              disabled={isGeneratingArabicSlides}
              className="h-10 px-3 flex items-center gap-2 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-white/10 transition-colors text-xs font-medium"
              title="Generate Arabic translation"
            >
              {isGeneratingArabicSlides ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin"></span>
                  Translating...
                </>
              ) : (
                '+ Arabic Slides'
              )}
            </button>
          ) : null}
        </div>

        {/* Right: Grid + Fullscreen */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onGrid(); }}
            className="w-12 h-12 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            title="Slide overview (G)"
          >
            <Grid3X3 className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onFullscreen(); }}
            className="w-12 h-12 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            title="Fullscreen (F)"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
