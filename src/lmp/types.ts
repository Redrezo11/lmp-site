/**
 * The Learning Module Package format, as docs/specs/module-format-spec.md
 * describes it. Core shapes are typed fully; the LessonForge profile (lf.*)
 * blocks are typed loosely here: phase 2 uses the vendored LessonForge types
 * (src/player/lf/vendor/src/types) for their insides.
 */

export interface LessonRef {
  id: string;
  title: string;
  source: string;
  kind?: 'presentation' | 'deck' | 'exercises' | 'session' | 'lesson';
}

export interface Manifest {
  format: 'LMP';
  formatVersion: string;
  id: string;
  title: string;
  description?: string;
  language: string;
  languages?: string[];
  thumbnail?: string;
  entry: string;
  lessons: LessonRef[];
  tags?: string[];
  profiles?: string[];
  generator?: { name: string; version: string; exportedAt: string; sourceId?: string; sourceKind?: string };
  meta?: Record<string, unknown> & { exportWarnings?: string[] };
}

export interface CaptionLine { start: number; end: number; text: string }

export interface BlockBase { id: string; type: string; title?: string; meta?: Record<string, unknown> }

export type CoreBlock =
  | (BlockBase & { type: 'text'; html?: string; markdown?: string })
  | (BlockBase & { type: 'image'; src: string; alt: string; caption?: string })
  | (BlockBase & { type: 'audio'; src: string; mime?: string; duration?: number; transcript?: string; captions?: CaptionLine[] })
  | (BlockBase & { type: 'video'; src?: string; url?: string; mime?: string; poster?: string; captions?: CaptionLine[] })
  | (BlockBase & { type: 'info'; text: string; tone?: 'info' | 'tip' | 'warning' })
  | (BlockBase & { type: 'summary'; points: string[] })
  | (BlockBase & { type: 'multiple-choice'; question: string; options: Array<{ id: string; text: string }>; correct: string[]; feedback?: { correct?: string; incorrect?: string }; explanation?: string })
  | (BlockBase & { type: 'multiple-response'; question: string; options: Array<{ id: string; text: string }>; correct: string[]; rule?: 'all' | 'any'; feedback?: { correct?: string; incorrect?: string } })
  | (BlockBase & { type: 'true-false'; statement: string; correct: boolean; feedback?: { correct?: string; incorrect?: string } })
  | (BlockBase & { type: 'fill-blank'; text: string; answers: string[][]; caseSensitive?: boolean })
  | (BlockBase & { type: 'matching'; pairs: Array<{ left: string; right: string }> })
  | (BlockBase & { type: 'ordering'; items: string[]; shuffle?: boolean })
  | (BlockBase & { type: 'short-answer'; prompt: string; answers?: string[]; mode?: 'auto' | 'compare' | 'free' });

/** Any block, including lf.* and types this player doesn't know */
export type Block = CoreBlock | (BlockBase & Record<string, any>);

export interface LessonFile { id: string; title: string; blocks: Block[] }

/** Block types the format marks right or wrong */
export const MARKED_TYPES = new Set(['multiple-choice', 'multiple-response', 'true-false', 'fill-blank', 'matching', 'ordering', 'short-answer']);

/** A module ready to play: its files, and how to turn a package path into a URL */
export interface LoadedModule {
  manifest: Manifest;
  files: Record<string, LessonFile>;
  /** Package path → a URL the browser can load (site path, or blob: for an imported file) */
  resolve: (packagePath: string) => string;
  /** Where it came from */
  origin: 'site' | 'imported';
  warnings: string[];
}
