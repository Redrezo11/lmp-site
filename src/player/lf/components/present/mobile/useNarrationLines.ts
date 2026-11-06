import { useEffect, useMemo, useState } from 'react';
import { CaptionLine } from '../../../types/exercise';
import { captionsFor } from '../../../utils/captions';

/** Portrait vs landscape, following rotation and resizes */
export function useOrientation(): 'portrait' | 'landscape' {
  const get = () => (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
  const [o, setO] = useState<'portrait' | 'landscape'>(get);
  useEffect(() => {
    const on = () => setO(get());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); };
  }, []);
  return o;
}

/**
 * Narration as short lines with timings, so the phone can show readable text
 * in step with the audio (the slide itself is small on a phone): the clip's
 * word-timed captions, or its narration timed by length.
 */
export function useNarrationLines(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  entry: { narration?: string; duration?: number; captions?: CaptionLine[] } | undefined,
) {
  const lines = useMemo<CaptionLine[]>(() => {
    return captionsFor(entry);
  }, [entry]);

  // Follow the live element (speed changes stay in sync); -1 = not playing yet
  const [time, setTime] = useState<number | null>(null);
  useEffect(() => {
    if (!lines.length) { setTime(null); return; }
    const tick = () => {
      const a = audioRef.current;
      setTime(a && !a.ended ? a.currentTime : null);
    };
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [lines, audioRef]);

  const activeIndex = time === null ? -1 : lines.findIndex(l => time >= l.start && time < l.end);
  return { lines, activeIndex, activeText: activeIndex >= 0 ? lines[activeIndex].text : null };
}
