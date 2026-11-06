/**
 * Helpers for the browser checks (website-spec §10). The real module is the
 * Pros and Cons lesson in public/modules. Two small fixture modules cover what
 * that lesson can't: decks (PDF pages, PPTX reveals, a silent page) and the
 * select / self-check exercise screens. The fixtures exist only here: Playwright
 * adds them to catalog.json and serves their JSON, and their audio and pictures
 * are the Pros and Cons lesson's own files.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Page, Route } from '@playwright/test';

export const PC = 'critical-thinking-identifying-pros-and-cons';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pcDir = path.join(root, 'public', 'modules', PC);
export const pcJson = (rel: string) => JSON.parse(fs.readFileSync(path.join(pcDir, rel), 'utf8'));
export const pres = () => pcJson('content/presentation.json').blocks[0];
export const sessionBlock = () => pcJson('content/session.json').blocks[0];
export const exercisesBlock = () => pcJson('content/exercises.json').blocks[0];

// ── Fixture modules ──

const renderConfig = () => pres().renderConfig;
const enClip = (slideId: number) => pres().tracks.en.find((c: any) => c.slideId === slideId);
const arClip = (slideId: number) => pres().tracks.ar.find((c: any) => c.slideId === slideId);

function decksModule() {
  const img = 'assets/images/exercise-db149de6c7b1-1.png';
  const one = enClip(1);
  const pdf = {
    id: 'deck', type: 'lf.deck', title: 'Fixture PDF deck', sourceType: 'pdf', pageCount: 2,
    slides: [
      { id: 1, n: 1, type: 'image', heading: 'Page 1', imageUrl: img },
      { id: 2, n: 2, type: 'image', heading: 'Page 2', imageUrl: img },
      { id: 3, n: 3, type: 'image', heading: 'Page 3', imageUrl: img },
    ],
    renderConfig: renderConfig(),
    // Page 2 has no narration: Play all must move on after 5 s
    tracks: {
      en: [{ ...one, slideId: 1, elementTimings: [], annotationTimings: [] }, { ...one, slideId: 3, elementTimings: [], annotationTimings: [] }],
      ar: [{ ...arClip(1), slideId: 1, elementTimings: [], annotationTimings: [] }],
    },
  };
  const three = enClip(3);
  const pptx = {
    id: 'deck', type: 'lf.deck', title: 'Fixture PPTX deck', sourceType: 'pptx', pageCount: 1,
    slides: [{
      id: 1, n: 1, type: 'content', heading: 'Reasons to travel', body: 'You see new places.\n\nYou meet new people.',
      elements: [
        { id: 'heading', content: 'Reasons to travel', type: 'heading', revealGroup: 0 },
        { id: 'body_1', content: 'You see new places.', type: 'body', revealGroup: 1 },
        { id: 'body_2', content: 'You meet new people.', type: 'body', revealGroup: 2 },
      ],
    }],
    renderConfig: renderConfig(),
    tracks: { en: [{ ...three, slideId: 1, elementTimings: [{ elementId: 'heading', showAt: 0 }, { elementId: 'body_1', showAt: 2 }, { elementId: 'body_2', showAt: 4 }], annotationTimings: [] }] },
  };
  return {
    manifest: {
      format: 'LMP', formatVersion: '1.0', id: 'fixture-decks', title: 'Fixture: decks', language: 'en', languages: ['en', 'ar'],
      entry: 'pdf', profiles: ['lf/1'],
      lessons: [
        { id: 'pdf', title: 'PDF deck', source: 'content/pdf.json', kind: 'deck' },
        { id: 'pptx', title: 'PPTX deck', source: 'content/pptx.json', kind: 'deck' },
      ],
    },
    files: {
      'content/pdf.json': { id: 'pdf', title: 'PDF deck', blocks: [pdf] },
      'content/pptx.json': { id: 'pptx', title: 'PPTX deck', blocks: [pptx] },
    },
  };
}

function markingModule() {
  const exercise = {
    family: 'select_in_text', templateVersion: 1, instructions: 'Underline the topic sentence. Then answer the question.',
    marks: ['underline'], answerKey: { status: 'from-key' },
    items: [
      { number: '1', parts: [{ type: 'select', text: 'Laughter is good for you. It lowers stress. It also helps you sleep.', answer: [{ mark: 'underline', span: 'Laughter is good for you.' }], grading: 'auto' }] },
      { number: '2', parts: [{ type: 'text', prompt: 'Why is laughter good for you?', answers: ['It lowers stress.'], grading: 'show' }] },
    ],
  };
  const ex = {
    id: 'ex', type: 'lf.exercises',
    items: [{ id: 'aaaaaaaaaaa1', number: 1, images: ['assets/images/exercise-db149de6c7b1-1.png'], narration: 'Mark the topic sentence.', interactive: { family: 'select_in_text', scored: true, exercise } }],
  };
  const session = { id: 's', type: 'lf.student-session', title: 'Fixture: marking', exercisesRef: 'exercises#ex', assist: true };
  return {
    manifest: {
      format: 'LMP', formatVersion: '1.0', id: 'fixture-marking', title: 'Fixture: marking', language: 'en',
      entry: 'session', profiles: ['lf/1'],
      lessons: [
        { id: 'exercises', title: 'Exercises', source: 'content/exercises.json', kind: 'exercises' },
        { id: 'session', title: 'Student session', source: 'content/session.json', kind: 'session' },
      ],
    },
    files: {
      'content/exercises.json': { id: 'exercises', title: 'Exercises', blocks: [ex] },
      'content/session.json': { id: 'session', title: 'Student session', blocks: [session] },
    },
  };
}

export const FIXTURES = { 'fixture-decks': decksModule, 'fixture-marking': markingModule };

/** Serve the fixture modules alongside the real ones (no files added to public/) */
export async function serveFixtures(page: Page) {
  await page.route('**/catalog.json', async (route: Route) => {
    const res = await route.fetch();
    const cat = await res.json();
    for (const [id, make] of Object.entries(FIXTURES)) {
      const m = make().manifest;
      cat.modules.push({ id, title: m.title, language: m.language, profiles: m.profiles, path: `modules/${id}/`, lessons: m.lessons.map(l => ({ id: l.id, title: l.title, kind: l.kind })) });
    }
    await route.fulfill({ json: cat });
  });
  for (const [id, make] of Object.entries(FIXTURES)) {
    await page.route(`**/modules/${id}/**`, async (route: Route) => {
      const rel = new URL(route.request().url()).pathname.split(`/modules/${id}/`)[1];
      const m = make();
      if (rel === 'module.json') return route.fulfill({ json: m.manifest });
      if ((m.files as any)[rel]) return route.fulfill({ json: (m.files as any)[rel] });
      // Assets: the Pros and Cons lesson's own files (a redirect, so the server
      // answers range requests and audio can be seeked)
      if (fs.existsSync(path.join(pcDir, rel))) return route.fulfill({ status: 302, headers: { location: `/modules/${PC}/${rel}` } });
      return route.fulfill({ status: 404, body: 'not found' });
    });
  }
}

// ── In-page probes ──

/**
 * Installed before the page loads: remembers every Audio element the player
 * makes (it reuses one), records each reveal with the audio clock at that
 * moment, and lists any request that leaves the site.
 */
export async function installProbes(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    const Orig = window.Audio;
    w.__audios = [] as HTMLAudioElement[];
    const Patched = function (this: unknown, src?: string) { const a = new Orig(src); w.__audios.push(a); return a; } as unknown as typeof Audio;
    Patched.prototype = Orig.prototype;
    w.Audio = Patched;
    w.__audio = () => w.__audios[w.__audios.length - 1] || null;
    w.__reveals = [] as Array<{ text: string; t: number; src: string }>;
    const watch = () => new MutationObserver(muts => {
      for (const m of muts) {
        const el = m.target as HTMLElement;
        if (m.attributeName === 'class' && el.classList?.contains('reveal-wrapper') && el.classList.contains('revealed') && !(m.oldValue || '').includes('revealed')) {
          const a = w.__audio();
          w.__reveals.push({ text: el.textContent || '', t: a ? a.currentTime : -1, src: a?.src || '' });
        }
      }
    }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    if (document.documentElement) watch(); else document.addEventListener('DOMContentLoaded', watch);
  });
}

export const audioState = (page: Page) => page.evaluate(() => {
  const a = (window as any).__audio() as HTMLAudioElement | null;
  return a ? { src: a.src, t: a.currentTime, paused: a.paused, ended: a.ended, rate: a.playbackRate, duration: a.duration } : null;
});

/** Jump the playing clip to `secondsBeforeEnd` before its end (saves waiting a whole clip) */
export async function seekNearEnd(page: Page, secondsBeforeEnd = 0.4) {
  await page.waitForFunction(() => { const a = (window as any).__audio(); return !!a && Number.isFinite(a.duration) && a.currentTime > 0; });
  await page.evaluate((s) => {
    const a = (window as any).__audio() as HTMLAudioElement;
    a.currentTime = Math.max(0, a.duration - s);
  }, secondsBeforeEnd);
}

/** True when the page has no horizontal scroll */
export const noSideScroll = (page: Page) => page.evaluate(() => {
  const els = [document.scrollingElement!, ...Array.from(document.querySelectorAll<HTMLElement>('.overflow-y-auto'))];
  return els.every(e => e.scrollWidth <= e.clientWidth + 1);
});

export async function clearStorage(page: Page) {
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
}
