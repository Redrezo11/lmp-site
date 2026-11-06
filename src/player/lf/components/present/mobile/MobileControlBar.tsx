import React from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, RotateCcw, ListVideo, Grid3X3, X } from 'lucide-react';
import { Playback } from '../usePresentationPlayback';

const icon = 'w-6 h-6';

/**
 * Touch controls for the phone player — the same actions as the teacher's
 * ControlBar ("Play all", "This slide", speed, captions, slide grid), sized
 * for thumbs (48 px targets) and always visible (no hover to reveal them).
 *
 * "Play all" is THE play button (teacher's ruling, 2026-10-28: a student
 * watching a lesson plays the whole lesson, not one slide). "This slide" stays
 * as the secondary choice for going over a single slide.
 */
export function MobileControlBar({ pb, onGrid, compact = false, onClose }: {
  pb: Playback;
  onGrid: () => void;
  /** One slim row (landscape / enlarged view) */
  compact?: boolean;
  /** Enlarged view: a close button */
  onClose?: () => void;
}) {
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  const hasAudio = !!pb.currentAudioUrl;

  const thisSlide = !pb.isSlideshowMode && (
    <button
      onClick={stop(pb.toggleAudio)}
      disabled={!hasAudio}
      aria-label={pb.isAudioPlaying ? 'Pause' : pb.slideFinished ? 'Replay this slide' : 'Play this slide'}
      className={`h-12 px-4 rounded-full flex items-center gap-2 font-semibold text-sm transition-colors ${
        !hasAudio ? 'bg-white/5 text-white/25'
          : pb.isAudioPlaying ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white active:bg-white/20'
      }`}
    >
      {pb.isAudioPlaying ? <Pause className="w-5 h-5" /> : pb.slideFinished ? <RotateCcw className="w-5 h-5" /> : <ListVideo className="w-5 h-5" />}
      {!compact && <span>{pb.isAudioPlaying ? 'Pause' : pb.slideFinished ? 'Replay' : 'This slide'}</span>}
    </button>
  );

  const playAll = (
    <button
      onClick={stop(pb.toggleSlideshow)}
      aria-label={pb.isSlideshowMode ? 'Pause all' : 'Play all'}
      className={`h-12 px-5 rounded-full flex items-center gap-2 font-semibold text-sm transition-colors ${
        pb.isSlideshowMode ? 'bg-emerald-500 text-white' : 'bg-white text-slate-900 active:bg-white/80'
      }`}
    >
      {pb.isSlideshowMode ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
      {!compact && <span>{pb.isSlideshowMode ? 'Pause' : 'Play all'}</span>}
    </button>
  );

  const prev = (
    <button onClick={stop(pb.goPrev)} disabled={pb.currentIndex === 0} aria-label="Previous slide"
      className="w-12 h-12 rounded-full flex items-center justify-center text-white active:bg-white/10 disabled:text-white/20">
      <ChevronLeft className={icon} />
    </button>
  );
  const next = (
    <button onClick={stop(pb.goNext)} disabled={pb.currentIndex >= pb.total - 1} aria-label="Next slide"
      className="w-12 h-12 rounded-full flex items-center justify-center text-white active:bg-white/10 disabled:text-white/20">
      <ChevronRight className={icon} />
    </button>
  );

  const speed = (
    <button onClick={stop(pb.cyclePlaybackRate)} aria-label="Narration speed"
      className={`h-10 min-w-12 px-2 rounded-lg text-sm font-bold ${pb.playbackRate !== 1 ? 'text-sky-300 bg-white/10' : 'text-white/80 bg-white/5'}`}>
      {pb.playbackRate}×
    </button>
  );
  const cc = (
    <button onClick={stop(pb.toggleCaptions)} aria-label={pb.captionsOn ? 'Hide captions' : 'Show captions'} aria-pressed={pb.captionsOn}
      className={`h-10 min-w-12 px-2 rounded-lg text-xs font-bold ${pb.captionsOn ? 'text-sky-300 bg-white/10' : 'text-white/50 bg-white/5'}`}>
      <span className={`px-1 border rounded ${pb.captionsOn ? 'border-sky-300' : 'border-white/40 line-through'}`}>CC</span>
    </button>
  );
  const grid = (
    <button onClick={stop(onGrid)} aria-label="All slides"
      className="h-10 min-w-12 px-2 rounded-lg text-white/80 bg-white/5 flex items-center justify-center gap-1 text-xs">
      <Grid3X3 className="w-4 h-4" />{!compact && 'Slides'}
    </button>
  );
  const counter = (
    <span className="text-white/60 text-sm font-medium tabular-nums min-w-[52px] text-center">{pb.currentIndex + 1} / {pb.total}</span>
  );

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-1 px-2 py-1.5 bg-black/70 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">{prev}{playAll}{thisSlide}{next}</div>
        <div className="flex items-center gap-1">
          {counter}{speed}{cc}{onClose ? (
            <button onClick={stop(onClose)} aria-label="Close" className="w-10 h-10 rounded-lg bg-white/10 text-white flex items-center justify-center"><X className="w-5 h-5" /></button>
          ) : grid}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 border-t border-white/10 px-3 pt-2" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        {prev}
        <div className="flex items-center gap-2">{playAll}{thisSlide}</div>
        {next}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        {speed}{cc}{grid}{counter}
      </div>
    </div>
  );
}
