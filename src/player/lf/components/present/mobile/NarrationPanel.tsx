import { useEffect, useRef, useState } from 'react';
import { CaptionLine } from '../../../types/exercise';

const FONT_KEY = 'replayFontSize';
const SIZES = [15, 17, 19, 22, 26];

function loadSize(): number {
  try {
    const n = Number(localStorage.getItem(FONT_KEY));
    if (SIZES.includes(n)) return n;
  } catch { /* storage unavailable */ }
  return 17;
}

/**
 * What the narrator says, as large readable text under the (small) slide —
 * the current line highlighted and kept in view while the audio plays. This
 * is the phone's closed captions: CC off hides it.
 */
export function NarrationPanel({ lines, activeIndex, rtl, exact }: {
  lines: CaptionLine[];
  activeIndex: number;
  rtl: boolean;
  /** Word-timed captions (exercises) rather than lines timed by length */
  exact: boolean;
}) {
  const [size, setSize] = useState(loadSize);
  const boxRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  const change = (dir: 1 | -1) => {
    const i = Math.max(0, Math.min(SIZES.length - 1, SIZES.indexOf(size) + dir));
    setSize(SIZES[i]);
    try { localStorage.setItem(FONT_KEY, String(SIZES[i])); } catch { /* ignore */ }
  };

  // Keep the spoken line in view — scroll the panel only, never the page
  useEffect(() => {
    const box = boxRef.current;
    const el = lineRefs.current[activeIndex];
    if (!box || !el) return;
    const target = el.offsetTop - box.clientHeight / 3;
    box.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [activeIndex]);

  // New slide → back to the top
  useEffect(() => { boxRef.current?.scrollTo({ top: 0 }); }, [lines]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-900/60 border-t border-white/10">
      <div className="flex items-center justify-between px-4 pt-2 pb-1 text-[11px] uppercase tracking-wider text-white/40">
        <span>{exact ? 'Captions' : 'What the teacher says'}</span>
        <span className="flex gap-1">
          <button aria-label="Smaller text" onClick={() => change(-1)} className="w-8 h-7 rounded bg-white/10 active:bg-white/20 text-white/80 normal-case">A−</button>
          <button aria-label="Bigger text" onClick={() => change(1)} className="w-8 h-7 rounded bg-white/10 active:bg-white/20 text-white/80 normal-case">A+</button>
        </span>
      </div>
      <div ref={boxRef} dir={rtl ? 'rtl' : 'ltr'} className="relative flex-1 min-h-0 overflow-y-auto px-4 pb-4" style={{ fontSize: size, lineHeight: 1.5 }}>
        {lines.length === 0 ? (
          <p className="text-white/40 text-sm pt-2">No narration on this slide.</p>
        ) : lines.map((l, i) => (
          <p
            key={i}
            ref={(el) => { lineRefs.current[i] = el; }}
            className={`py-1 transition-colors duration-300 ${
              activeIndex < 0 ? 'text-white/85'
                : i === activeIndex ? 'text-white font-semibold'
                : i < activeIndex ? 'text-white/40' : 'text-white/60'
            }`}
          >
            {l.text}
          </p>
        ))}
      </div>
    </div>
  );
}
