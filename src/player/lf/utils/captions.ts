import type { CaptionLine } from '../types/exercise';

/**
 * Narration as short timed lines, for captions when a clip has no word-timed
 * track: one line per sentence, timed by its length. Close enough to follow
 * along; a word-timed track (buildCaptions on the server) replaces it.
 */
export function splitNarration(text: string, duration: number): CaptionLine[] {
  const clean = text.replace(/<<[^>]+>>/g, '').replace(/\s+/g, ' ').trim();
  if (!clean || !duration) return [];
  const sentences = (clean.match(/[^.!?؟…]+[.!?؟…]*["'”’)\]]*\s*/g) || [clean]).map(s => s.trim()).filter(Boolean);
  const total = sentences.reduce((n, s) => n + s.length, 0);
  let t = 0;
  return sentences.map(s => {
    const start = t;
    t += (s.length / total) * duration;
    return { start, end: t, text: s };
  });
}

/** A clip's captions: its word-timed track, else its narration timed by length */
export function captionsFor(audio: { narration?: string; duration?: number; captions?: CaptionLine[] } | undefined | null): CaptionLine[] {
  if (!audio) return [];
  if (audio.captions?.length) return audio.captions;
  return splitNarration(audio.narration || '', audio.duration || 0);
}
