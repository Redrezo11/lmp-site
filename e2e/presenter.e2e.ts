/**
 * Checklist items 1–8 (website-spec §10): the projector presenter, the phone
 * player, and decks. Real audio plays (Chrome, autoplay allowed); long clips
 * are jumped to near their end instead of waited out.
 */
import { test, expect, Page } from '@playwright/test';
import { PC, pres, exercisesBlock, installProbes, serveFixtures, audioState, seekNearEnd, noSideScroll } from './support';
import { splitNarration } from '../src/player/lf/utils/captions';

const open = async (page: Page, hash: string) => {
  await installProbes(page);
  await serveFixtures(page);
  await page.goto(`/#${hash}`);
  // the player is on screen (the module loads first)
  await expect(page.getByText(/^\d+ \/ \d+$/).first()).toBeVisible();
};
const counter = (page: Page) => page.locator('text=/^\\d+ \\/ \\d+$/').first();
const caption = (page: Page) => page.locator('span.bg-black\\/80');
const chooseEnglish = async (page: Page) => { await page.getByRole('button', { name: /English/ }).click(); };

test.describe('presenter (desktop)', () => {
  test('1. the 1280×720 canvas is scaled to fit, no sideways scroll at 1280 and 1024', async ({ page }) => {
    await open(page, `/m/${PC}/presentation`);
    const canvas = page.locator('div[style*="width: 1280px"][style*="height: 720px"]').first();
    await expect(canvas).toBeVisible();
    expect(Math.abs((await canvas.boundingBox())!.width - 1280)).toBeLessThanOrEqual(2);   // 1 px border each side
    expect(await noSideScroll(page)).toBe(true);
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect.poll(async () => Math.abs((await canvas.boundingBox())!.width - 1024)).toBeLessThanOrEqual(2);
    expect(Math.abs((await canvas.boundingBox())!.height - 576)).toBeLessThanOrEqual(2);
    expect(await noSideScroll(page)).toBe(true);
  });

  test('2. Play all: picker first, advances on end, slide 3 reveals on time, stops at the end of the lesson', async ({ page }) => {
    await open(page, `/m/${PC}/presentation`);
    await page.keyboard.press('s');
    await expect(page.getByRole('button', { name: /العربية/ })).toBeVisible();   // item 4: the picker on first play
    await chooseEnglish(page);
    await expect.poll(async () => (await audioState(page))?.src || '').toContain('/audio/en/slide-1.mp3');
    await seekNearEnd(page);
    await expect(counter(page)).toHaveText('2 / 5');
    await expect.poll(async () => (await audioState(page))?.src || '').toContain('/audio/en/slide-2.mp3');
    await seekNearEnd(page);
    await expect(counter(page)).toHaveText('3 / 5');
    // Slide 3: body_1 at 6.04 s, body_2 at 14.26 s (audio clock), ±0.1 s
    const slide3 = pres().slides.find((s: any) => s.id === 3);
    const body = (id: string) => slide3.elements.find((e: any) => e.id === id).content as string;
    const timing = (id: string) => pres().tracks.en.find((c: any) => c.slideId === 3).elementTimings.find((t: any) => t.elementId === id).showAt as number;
    await page.waitForFunction(() => (window as any).__reveals.filter((r: any) => r.src.includes('slide-3')).length >= 2, null, { timeout: 30_000 });
    const reveals = await page.evaluate(() => (window as any).__reveals.filter((r: any) => r.src.includes('slide-3')));
    for (const id of ['body_1', 'body_2']) {
      const hit = reveals.find((r: any) => r.text.includes(body(id).replace(/\*/g, '').slice(0, 20)));
      expect(hit, `${id} revealed`).toBeTruthy();
      console.log(`${id}: shown at ${hit.t.toFixed(3)} s, due ${timing(id).toFixed(3)} s`);
      expect(Math.abs(hit.t - timing(id))).toBeLessThanOrEqual(0.1);
    }
    await seekNearEnd(page);
    await expect(counter(page)).toHaveText('4 / 5');
    await expect.poll(async () => (await audioState(page))?.src || '').toContain('/audio/en/slide-4.mp3');
    await seekNearEnd(page);
    await expect(page.getByText(/End of the lesson — (an exercise|exercises) follows?/)).toBeVisible();
    await expect(counter(page)).toHaveText('4 / 5');
    await expect(page.getByRole('button', { name: 'Play all' })).toBeVisible();   // back to manual
  });

  test('3. captions follow the sentences; C hides them and is remembered', async ({ page }) => {
    await open(page, `/m/${PC}/presentation`);
    const clip = pres().tracks.en.find((c: any) => c.slideId === 1);
    const lines = splitNarration(clip.narration, clip.duration);
    expect(lines.length).toBeGreaterThan(1);
    await page.keyboard.press(' ');
    await chooseEnglish(page);
    await expect(caption(page)).toHaveText(lines[0].text);
    await page.evaluate((t) => { (window as any).__audio().currentTime = t; }, lines[1].start + 0.2);
    await expect(caption(page)).toHaveText(lines[1].text);
    await page.keyboard.press('c');
    await expect(caption(page)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('presenterCaptions'))).toBe('off');
    await page.reload();
    await expect(counter(page)).toBeVisible();
    await page.keyboard.press(' ');
    await chooseEnglish(page);
    await expect.poll(async () => (await audioState(page))?.t || 0).toBeGreaterThan(0.5);
    await expect(caption(page)).toHaveCount(0);
  });

  test('4. L switches to the Arabic slides and the Arabic clip; captions are right-to-left', async ({ page }) => {
    await open(page, `/m/${PC}/presentation`);
    const ar = pres().slidesAr[0];
    await page.keyboard.press('l');
    await expect(page.getByRole('button', { name: 'AR', exact: true })).toBeVisible();
    await expect(page.getByText(ar.heading).filter({ visible: true }).first()).toBeVisible();
    await page.keyboard.press(' ');
    await expect.poll(async () => (await audioState(page))?.src || '').toContain('/audio/ar/slide-1.mp3');
    await expect(caption(page)).toHaveAttribute('dir', 'rtl');
    expect((await audioState(page))!.rate).toBe(1);   // Arabic defaults to 1×
  });

  test('5. speed cycles 0.9 → 0.8 → 0.7 → 1 and is remembered per language', async ({ page }) => {
    await open(page, `/m/${PC}/presentation`);
    const rate = page.getByTitle('Narration speed');
    await expect(rate).toHaveText('0.9×');
    for (const next of ['0.8×', '0.7×', '1×', '0.9×', '0.8×']) { await rate.click(); await expect(rate).toHaveText(next); }
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem('presenterPlaybackRates')))!)).toEqual({ en: 0.8, ar: 1 });
    await page.reload();
    await expect(counter(page)).toBeVisible();
    await expect(rate).toHaveText('0.8×');
    await page.keyboard.press('l');
    await expect(page.getByRole('button', { name: 'AR', exact: true })).toBeVisible();
    await expect(rate).toHaveText('1×');
    await page.keyboard.press(' ');
    await expect.poll(async () => (await audioState(page))?.src || '').toContain('/audio/ar/');
    await expect.poll(async () => (await audioState(page))?.rate).toBe(1);
    await page.keyboard.press('l');
    await expect(page.getByRole('button', { name: 'EN', exact: true })).toBeVisible();
    await page.keyboard.press(' ');
    await expect.poll(async () => (await audioState(page))?.src || '').toContain('/audio/en/');
    await expect.poll(async () => (await audioState(page))?.rate).toBe(0.8);
  });

  test('7. the exercise slide: picture, chip, word-timed captions, Student session button and its QR code', async ({ page }) => {
    await open(page, `/m/${PC}/presentation`);
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await expect(counter(page)).toHaveText('4 / 5');
    await expect(page.getByRole('button', { name: 'Exercises (1) →' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Student session' })).toBeVisible();
    await page.getByRole('button', { name: 'Exercises (1) →' }).click();
    await expect(page.getByText('Exercise 1 of 1')).toBeVisible();
    await expect(page.locator('img[src*="exercise-db149de6c7b1-1.png"]')).toBeVisible();
    const ex = exercisesBlock().items[0];
    await page.keyboard.press(' ');
    await chooseEnglish(page);
    await expect(caption(page)).toHaveText(ex.audio.captions[0].text);
    await page.evaluate((t) => { (window as any).__audio().currentTime = t; }, ex.audio.captions[3].start + 0.05);
    await expect(caption(page)).toHaveText(ex.audio.captions[3].text);
    await page.keyboard.press(' ');
    await page.getByRole('button', { name: 'Student session' }).click();
    await expect(page.getByRole('heading', { name: 'Scan to do Exercise 1 on your phone' })).toBeVisible();
    await expect(page.locator('img[alt="Assessment QR code"]')).toHaveAttribute('src', /^data:image\/png/);
    const url = await page.locator('p.select-all').textContent();
    expect(url).toMatch(new RegExp(`#/m/${PC}/session\\?exercise=${ex.id}$`));
    await page.getByRole('link', { name: 'Open here' }).click();
    await expect(page.getByRole('dialog', { name: 'Exercise 1' })).toBeVisible();   // the session opens that exercise
  });
});

test.describe('annotations (format sheet §7.4)', () => {
  // Slide 2: a yellow highlight over "the pros (reasons for) and cons (reasons against)", 6.28 s → 15.66 s
  const playSlide2At = async (page: Page, t: number) => {
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press(' ');
    await chooseEnglish(page);
    await page.waitForFunction(() => { const a = (window as any).__audio(); return !!a && Number.isFinite(a.duration) && a.currentTime > 0; });
    await page.evaluate((x) => { (window as any).__audio().currentTime = x; }, t);
  };

  test('a highlight is drawn with the Custom Highlight API while it is active', async ({ page }) => {
    await open(page, `/m/${PC}/presentation`);
    await playSlide2At(page, 7);
    await expect.poll(() => page.evaluate(() => (CSS as any).highlights.get('annotation-subject')?.size || 0)).toBe(1);
    expect(await page.evaluate(() => [...(CSS as any).highlights.get('annotation-subject')][0].toString())).toBe('the pros (reasons for) and cons (reasons against)');
    await page.evaluate(() => { (window as any).__audio().currentTime = 15.8; });
    await expect.poll(() => page.evaluate(() => (CSS as any).highlights.has('annotation-subject'))).toBe(false);
  });

  test('without the API the same words are wrapped in a <mark> with the same colour, and unwrapped after', async ({ page }) => {
    await page.addInitScript(() => { try { Object.defineProperty(CSS, 'highlights', { value: undefined }); } catch { /* */ } });
    await open(page, `/m/${PC}/presentation`);
    await playSlide2At(page, 7);
    // one <mark> per text node the phrase crosses (the slide puts parts of it in bold)
    const marks = page.locator('mark.annotation-subject');
    await expect.poll(async () => (await marks.allTextContents()).join('')).toBe('the pros (reasons for) and cons (reasons against)');
    expect(await marks.first().evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(250, 204, 21, 0.4)');
    const before = await page.locator('.reveal-wrapper', { hasText: 'reasons against' }).textContent();
    await page.evaluate(() => { (window as any).__audio().currentTime = 15.8; });
    await expect(page.locator('mark.annotation-mark')).toHaveCount(0);
    expect(await page.locator('.reveal-wrapper', { hasText: 'reasons against' }).textContent()).toBe(before);
  });
});

test.describe('decks', () => {
  test('6. Play all moves on from a page with no narration after 5 s', async ({ page }) => {
    await open(page, '/m/fixture-decks/pdf');
    await page.keyboard.press('s');
    await chooseEnglish(page);
    await expect.poll(async () => (await audioState(page))?.src || '').toContain('slide-1.mp3');
    await seekNearEnd(page);
    await expect(counter(page)).toHaveText('2 / 3');
    const arrived = Date.now();
    await expect(counter(page)).toHaveText('3 / 3', { timeout: 8000 });
    const waited = Date.now() - arrived;
    console.log(`silent page: moved on after ${waited} ms`);
    expect(waited).toBeGreaterThan(4500);
    expect(waited).toBeLessThan(6000);
    // "This slide" on the silent page says so
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press(' ');
    await expect(page.getByText('No narration on this slide yet')).toBeVisible();
  });

  test('8a. PDF deck: the page picture on black, captions, the Arabic track with the same pictures', async ({ page }) => {
    await open(page, '/m/fixture-decks/pdf');
    const img = page.locator('img[alt="Page 1"]');
    await expect(img).toBeVisible();
    expect(await img.evaluate(el => getComputedStyle(el.parentElement!).backgroundColor)).toBe('rgb(0, 0, 0)');
    await page.keyboard.press(' ');
    await chooseEnglish(page);
    await expect(caption(page)).toBeVisible();
    await page.keyboard.press('l');
    await expect(page.locator('img[alt="Page 1"]')).toBeVisible();
    await page.keyboard.press(' ');
    await expect.poll(async () => (await audioState(page))?.src || '').toContain('/audio/ar/slide-1.mp3');
    await expect(caption(page)).toHaveAttribute('dir', 'rtl');
  });

  test('8b. PPTX deck: body paragraphs reveal in time', async ({ page }) => {
    await open(page, '/m/fixture-decks/pptx');
    const first = page.locator('.reveal-wrapper', { hasText: 'You see new places.' });
    await expect(first).not.toHaveClass(/revealed/);   // hidden before the clip plays
    await page.keyboard.press(' ');
    await page.waitForFunction(() => (window as any).__reveals.filter((r: any) => /You (see|meet)/.test(r.text)).length >= 2, null, { timeout: 15_000 });
    const r = await page.evaluate(() => (window as any).__reveals.filter((x: any) => /You (see|meet)/.test(x.text)));
    const at = (s: string) => r.find((x: any) => x.text.includes(s)).t;
    console.log(`pptx reveals: ${at('see').toFixed(3)} s (due 2), ${at('meet').toFixed(3)} s (due 4)`);
    expect(Math.abs(at('see') - 2)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(at('meet') - 4)).toBeLessThanOrEqual(0.1);
  });
});

test.describe('phone player (390 × 844)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('1. no sideways scroll; the slide, the narration panel and thumb controls', async ({ page }) => {
    await open(page, `/m/${PC}/presentation`);
    await expect(page.getByText('Slide 1 of 4')).toBeVisible();
    await expect(page.getByText('What the teacher says')).toBeVisible();
    expect(await noSideScroll(page)).toBe(true);
    await page.getByRole('button', { name: 'Play all' }).click();
    await page.getByRole('button', { name: /English/ }).click();
    await expect.poll(async () => (await audioState(page))?.src || '').toContain('/audio/en/slide-1.mp3');
    await seekNearEnd(page);
    await expect(page.getByText('Slide 2 of 4')).toBeVisible();
  });

  test('7. the exercise slide opens the exercise sheet; the last slide offers the session', async ({ page }) => {
    await open(page, `/m/${PC}/presentation`);
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next slide' }).click();
    await expect(page.getByText('Exercise 1 of 1')).toBeVisible();
    await expect(page.getByText('Captions', { exact: true })).toBeVisible();   // word-timed lines
    await expect(page.getByRole('button', { name: 'Student session →' })).toBeVisible();
    await page.getByRole('button', { name: 'Do this exercise' }).click();
    await expect(page.getByRole('dialog', { name: 'Exercise 1' })).toBeVisible();
    expect(await noSideScroll(page)).toBe(true);
  });
});
