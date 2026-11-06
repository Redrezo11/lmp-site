import { X, Play } from 'lucide-react';
import { SlidePreview } from '../../types/lesson';
import { SlideRenderConfig } from '../../types/slideRender';
import { SlideViewer } from '../preview/SlideViewer';

interface SlideGridProps {
  slides: SlidePreview[];
  renderConfig: SlideRenderConfig;
  currentIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
  /** Jump to a slide and play just its narration — one tap to any slide */
  onPlay?: (index: number) => void;
  /** Slides that have narration audio (only these get a Play button) */
  playableSlideIds?: number[];
}

export function SlideGrid({ slides, renderConfig, currentIndex, onSelect, onClose, onPlay, playableSlideIds }: SlideGridProps) {
  return (
    <div
      className="absolute inset-0 z-30 bg-black/90 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-40 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Grid */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 p-6 pt-16 max-w-6xl mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {slides.map((slide, i) => {
          const playable = !!onPlay && !!playableSlideIds?.includes(slide.id);
          return (
            <div key={slide.id} className="relative">
              <button
                onClick={() => onSelect(i)}
                className={`relative w-full rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                  i === currentIndex
                    ? 'border-white shadow-lg shadow-white/20'
                    : 'border-transparent hover:border-white/40'
                }`}
              >
                <div className="pointer-events-none">
                  <SlideViewer slide={slide} renderConfig={renderConfig} />
                </div>
                {/* Slide number overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <span className="text-white text-xs font-medium">{i + 1}</span>
                </div>
              </button>
              {playable && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPlay!(i); }}
                  className="absolute top-2 right-2 z-10 h-8 px-2.5 flex items-center gap-1 rounded-full bg-black/75 hover:bg-indigo-600 text-white text-xs font-semibold transition-colors"
                  title="Play just this slide"
                >
                  <Play className="w-3.5 h-3.5" /> Play
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
