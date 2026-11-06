// Exercise explainers — an optional add-on to a lesson: a picture of a textbook
// exercise, narrated (EN + AR) to explain HOW to do it, with closed captions.
// Shared by client and server (like src/types/lesson.ts).

import type { DigitalResult } from './exerciseTemplates';

export interface CaptionLine {
  start: number;   // seconds into the audio
  end: number;
  text: string;
}

export interface ExerciseAudio {
  url: string;
  duration: number;
  captions: CaptionLine[];
}

export interface ExerciseJob {
  kind: 'narration' | 'audio' | 'digitise' | 'answerkey' | 'all';
  status: 'generating' | 'done' | 'failed';
  error: string | null;
  updatedAt: string;
  done?: number;
  total?: number;
}

export const MAX_EXERCISE_PAGES = 4;

export interface Exercise {
  id: string;
  /** First page (kept for exercises made before multi-page) */
  imageUrl: string;
  /** All pages in order (1–4); missing on older exercises — use exercisePages() */
  imageUrls?: string[];
  narration: string;     // English: how to do the exercise
  narrationAr: string;   // the same in Arabic
  audio: ExerciseAudio | null;
  audioAr: ExerciseAudio | null;
  job: ExerciseJob | null;
  /** Interactive version for students' phones (exerciseTemplates.ts), once digitised */
  digital?: DigitalResult | null;
  /** Scanned answers page(s): an answer-key page, or the page with the answers showing (1–3) */
  answerKeyUrls?: string[];
  /** Use another exercise's answers pages instead of scanning again (exercise id) */
  answerKeyFrom?: string;
  /** Which exercise on the picture, when it shows several ("Activity C") */
  focus?: string | null;
}

export const MAX_KEY_PAGES = 3;

/** The answers pages to use for an exercise: its own, else the ones it borrows */
export function exerciseKeyPages(ex: { answerKeyUrls?: string[]; answerKeyFrom?: string } | null | undefined, list: Array<{ id: string; answerKeyUrls?: string[] }>): string[] {
  if (!ex) return [];
  if (ex.answerKeyUrls?.length) return ex.answerKeyUrls.filter(Boolean);
  if (ex.answerKeyFrom) return list.find(e => e.id === ex.answerKeyFrom)?.answerKeyUrls?.filter(Boolean) || [];
  return [];
}

/** The exercise's pages in order — works for old one-page exercises too */
export function exercisePages(ex: { imageUrl?: string; imageUrls?: string[] } | null | undefined): string[] {
  if (!ex) return [];
  if (Array.isArray(ex.imageUrls) && ex.imageUrls.length) return ex.imageUrls.filter(Boolean);
  return ex.imageUrl ? [ex.imageUrl] : [];
}
