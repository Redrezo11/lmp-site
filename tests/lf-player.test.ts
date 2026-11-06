/**
 * The LessonForge player, fed from a module (phase 2). These check the bridge
 * (src/player/lf/fromModule.ts) against the real Pros and Cons lesson, and the
 * vendored rules the fidelity checklist depends on. The browser checks for the
 * same checklist are in e2e/ (`npm run e2e`).
 */
import path from 'path';
import { describe, it, expect } from 'vitest';
import { readModule } from '../tools/read';
import { validateModule } from '../src/lmp/validate';
import type { LoadedModule } from '../src/lmp/types';
import { viewerData, assessmentPayload, findBlock, sessionUrl, replayPayload } from '../src/player/lf/fromModule';
import { splitNarration, captionsFor } from '../src/player/lf/utils/captions';
import { optionOrder } from '../src/player/lf/utils/seededShuffle';
import { toPracticeItems } from '../src/player/lf/components/exercises/digital/toPracticeItems';
import { cleanPracticeSet } from '../src/player/lf/pages/PracticePage';
import { normalizeAnswer } from '../src/player/lf/utils/typedAnswers';
import { fontFamily } from '../src/player/lf/utils/fontLoader';
import { FIXTURES } from '../e2e/support';

const PC = 'critical-thinking-identifying-pros-and-cons';
const disk = readModule(path.join(__dirname, '..', 'public', 'modules', PC));
const mod: LoadedModule = { manifest: disk.manifest, files: disk.files, origin: 'site', warnings: [], resolve: p => `modules/${PC}/${p}` };
const block = (lessonId: string): any => mod.files[mod.manifest.lessons.find(l => l.id === lessonId)!.source].blocks[0];

describe('the presentation, as the presenter receives it', () => {
  const v = viewerData(mod, block('presentation'));
  it('lesson slides, then one exercise slide with LessonForge\'s id and layout', () => {
    expect(v.slides.map(s => s.id)).toEqual([1, 2, 3, 4]);
    expect(v.exercises).toHaveLength(1);
    expect(v.exercises[0].slide).toMatchObject({ id: 100000, type: 'image', layout: 'exercise', heading: 'Exercise 1' });
    expect(v.exercises[0].slide.imageUrls).toEqual([`modules/${PC}/assets/images/exercise-db149de6c7b1-1.png`]);
    expect(v.phoneExerciseIds).toEqual(['db149de6c7b1']);
  });
  it('clips keep their timings untouched and get site URLs', () => {
    const raw = block('presentation').tracks.en.find((c: any) => c.slideId === 3);
    const clip = v.slideAudio!.find(a => a.slideId === 3) as any;
    expect(clip.url).toBe(`modules/${PC}/assets/audio/en/slide-3.mp3`);
    expect(clip.elementTimings).toEqual(raw.elementTimings);
    expect(clip.annotationTimings).toEqual(raw.annotationTimings);
    expect(clip.elementTimings.find((t: any) => t.elementId === 'body_1').showAt).toBeCloseTo(6.04, 2);
    expect(clip.elementTimings.find((t: any) => t.elementId === 'body_2').showAt).toBeCloseTo(14.26, 2);
  });
  it('Arabic: its own slides and track; the exercise has an Arabic clip', () => {
    expect(v.slidesAr).toHaveLength(4);
    expect(v.slideAudioAr!.every(a => a.url.includes('/audio/ar/'))).toBe(true);
    expect(v.exercises[0].audioAr?.url).toContain('/audio/ar/exercise-db149de6c7b1.mp3');
  });
  it('the session button points at the site\'s own page', () => {
    expect(v.sessionRef).toBe('session#s');
    expect(sessionUrl(PC, 'https://x.github.io/lmp-site/#/m/abc')).toBe(`https://x.github.io/lmp-site/#/m/${PC}/session`);
  });
  it('the phone player gets the same slides, clips and exercises', () => {
    const r = replayPayload(v);
    expect(r.slides).toBe(v.slides);
    expect(r.exercises[0].interactive?.family).toBe('chart_fill');
  });
});

describe('decks and exercises alone', () => {
  it('a deck with an Arabic track and no slidesAr shows its own slides in Arabic', () => {
    const f = FIXTURES['fixture-decks']();
    const m: LoadedModule = { manifest: f.manifest as any, files: f.files as any, origin: 'site', warnings: [], resolve: p => p };
    const v = viewerData(m, (f.files as any)['content/pdf.json'].blocks[0]);
    expect(v.slidesAr).toBe(v.slides);
    expect(v.slideAudio!.map(a => a.slideId)).toEqual([1, 3]);   // page 2 is silent
  });
  it('the exercises lesson: no lesson slides, the explainer only, the presentation\'s look', () => {
    const v = viewerData(mod, block('exercises'));
    expect(v.slides).toEqual([]);
    expect(v.exercises).toHaveLength(1);
    expect(v.renderConfig).toEqual(block('presentation').renderConfig);
    expect(v.sessionRef).toBe('session#s');
  });
});

describe('the session, as the session page receives it', () => {
  const s = assessmentPayload(mod, block('session'));
  it('the quiz, the practice, the slides for "see the slide", the phone exercise', () => {
    expect(s.questions).toHaveLength(5);
    expect(s.practice?.levels.map(l => l.level)).toEqual(['remember', 'understand', 'apply', 'analyze', 'challenge']);
    expect(s.slides).toHaveLength(4);
    expect(s.hasReplay).toBe(true);
    expect(s.replayMinutes).toBe(2);
    expect(s.exercises).toEqual([expect.objectContaining({ id: 'db149de6c7b1', number: 1 })]);
  });
  it('refs resolve to the blocks they name', () => {
    expect(findBlock(mod, 'exercises#ex')?.type).toBe('lf.exercises');
    expect(findBlock(mod, 'nowhere#x')).toBeNull();
  });
  it('the practice set survives LessonForge\'s cleanup', () => {
    const cleaned = cleanPracticeSet(s.practice)!;
    expect(cleaned.levels.reduce((n, l) => n + l.items.length, 0)).toBe(16);
  });
});

describe('vendored rules the checklist relies on', () => {
  it('captions: sentences, timed by length, covering the whole clip', () => {
    const lines = splitNarration('Welcome, everyone. Today we look at pros and cons! Ready? <<HIGHLIGHT x>>Let\'s go…', 10);
    expect(lines.map(l => l.text)).toEqual(['Welcome, everyone.', 'Today we look at pros and cons!', 'Ready?', 'Let\'s go…']);
    expect(lines[0].start).toBe(0);
    expect(lines[lines.length - 1].end).toBeCloseTo(10, 6);
    expect(captionsFor({ narration: 'x', duration: 3, captions: [{ start: 0, end: 1, text: 'given' }] })).toEqual([{ start: 0, end: 1, text: 'given' }]);
  });
  it('mcq options: the same shuffled order every time', () => {
    const q = assessmentPayload(mod, block('session')).questions[0];
    const a = optionOrder(q.questionText, q.options);
    expect(optionOrder(q.questionText, q.options)).toEqual(a);
    expect([...a].sort()).toEqual(q.options.map((_, i) => i));
  });
  it('typed answers: trim, lowercase, collapse spaces, strip trailing .?!', () => {
    expect(normalizeAnswer('  For   Doing It!? ')).toBe('for doing it');
  });
  it('the pros/cons exercise: two chart screens, boxes under Pros and Cons, answers vary (never marked)', () => {
    const ex = (findBlock(mod, 'exercises#ex') as any).items[0].interactive.exercise;
    const { items } = toPracticeItems(ex);
    expect(items).toHaveLength(2);
    for (const it of items) {
      expect(it.type).toBe('typed');
      expect((it as any).vary).toBe(true);
      expect(new Set((it as any).lines.map((l: any) => l.group))).toEqual(new Set(['Pros', 'Cons']));
    }
  });
  it('fonts: PowerPoint names map to the local substitutes', () => {
    expect(fontFamily('Calibri')).toBe('"Calibri", "Carlito", sans-serif');
    expect(fontFamily('Cambria')).toBe('"Cambria", "Caladea", serif');
    expect(fontFamily('Arial')).toBe('"Arial", sans-serif');
  });
});

describe('the browser checks\' fixture modules', () => {
  for (const [id, make] of Object.entries(FIXTURES)) {
    it(`${id} passes the format check`, () => {
      const f = make();
      expect(validateModule(f.manifest as any, f.files as any, null).errors).toEqual([]);
    });
  }
});
