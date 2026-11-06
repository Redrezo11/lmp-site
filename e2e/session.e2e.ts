/**
 * Checklist items 9–12 (website-spec §10): the student session page at phone
 * width, run by LessonForge's own session engine. Some checks start further
 * into the stream by writing LessonForge's resume state (`lf-session-<id>`),
 * exactly as the session itself stores it.
 */
import { test, expect, Page } from '@playwright/test';
import { PC, sessionBlock, serveFixtures, noSideScroll } from './support';
import { optionOrder } from '../src/player/lf/utils/seededShuffle';
import { cleanPracticeSet } from '../src/player/lf/pages/PracticePage';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const session = sessionBlock();
const practice = cleanPracticeSet(session.practice)!;
/** Levels as the session shows them in standard mode: the quiz, then practice without "challenge" */
const levels = [{ level: 'quiz', items: session.quiz }, ...practice.levels.filter(l => l.level !== 'challenge')];

async function fresh(page: Page, id = PC, seed?: Record<string, unknown>) {
  await serveFixtures(page);
  await page.goto('/');
  await page.evaluate(({ id, seed }) => {
    localStorage.clear(); sessionStorage.clear();
    for (const [k, v] of Object.entries(seed || {})) localStorage.setItem(k.replace('<id>', id), JSON.stringify(v));
  }, { id, seed });
  await page.goto(`/#/m/${id}/session`);
}
/** Skip the language and mode steps, and start at a level / item of the stream */
const startAt = (levelIndex: number, itemIndex: number, mode: 'choice' | 'typed' = 'choice') => ({
  'lf-progress-<id>': { session: { visited: true, done: [], correct: [], lf: { lang: 'en', mode } } },
  'lf-session-<id>': { mode: mode === 'typed' ? 'challenge' : 'standard', phase: 'item', levelIndex, itemIndex, results: {} },
});
const stored = (page: Page, id = PC) => page.evaluate((id) => JSON.parse(localStorage.getItem(`lf-session-${id}`) || '{}'), id);
const optionTexts = (page: Page) => page.locator('button:has(> span.font-semibold.mr-2)').allTextContents();

test('the page: header, watch the lesson, Arabic help, the exercises below; no sideways scroll', async ({ page }) => {
  await fresh(page);
  await expect(page.getByRole('heading', { name: session.title })).toBeVisible();
  await expect(page.getByRole('button', { name: `Watch the lesson (${session.replayMinutes} min)` }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'مساعدة بالعربية' })).toBeVisible();
  await expect(page.getByText('Exercises from the book (1)')).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });
  const box = await page.getByRole('heading', { name: session.title }).locator('xpath=ancestor::div[contains(@class,"max-w-[480px]")]').boundingBox();
  expect(box!.width).toBe(480);   // the phone layout, centred, on a desktop
  expect(Math.round(box!.x)).toBe((1280 - 480) / 2);
});

test('9. quiz first, options in the same shuffled order on every load, wrong answer shows the explanation', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: /English only/ }).click();
  await page.getByRole('button', { name: /Multiple Choice/ }).click();
  const q = session.quiz[0];
  await expect(page.getByText('Quiz', { exact: false }).first()).toBeVisible();
  await expect(page.getByText(q.questionText.split('_')[0].trim(), { exact: false }).first()).toBeVisible();
  const expected = optionOrder(q.questionText, q.options).map((i: number, pos: number) => `${String.fromCharCode(65 + pos)}.${q.options[i]}`);
  expect(await optionTexts(page)).toEqual(expected);
  await page.reload();
  await expect(page.getByText(q.questionText.split('_')[0].trim(), { exact: false }).first()).toBeVisible();
  expect(await optionTexts(page)).toEqual(expected);
  const wrong = q.options.find((o: string) => o !== q.correctAnswer);
  await page.getByRole('button', { name: new RegExp(`^[A-D]\\.${wrong}$`) }).click();
  await expect(page.getByText('✗ Not quite')).toBeVisible();
  await expect(page.getByText(q.explanation.slice(0, 40), { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Continue →' }).click();
  expect((await stored(page)).results['0']).toEqual([false]);
});

test('9. challenge mode: the quiz gap-fills are typed', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: /English only/ }).click();
  await page.getByRole('button', { name: /Challenge/ }).click();
  const q = session.quiz[0];
  await page.getByPlaceholder('Type the missing word(s)...').fill(q.correctAnswer);
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('✓ Correct!')).toBeVisible();
  await expect.poll(async () => (await stored(page)).results['0']).toEqual([true]);
});

test('10. match: one wrong tap and the item is not correct', async ({ page }) => {
  const li = levels.findIndex(l => l.items.some((i: any) => i.type === 'match'));
  const ii = levels[li].items.findIndex((i: any) => i.type === 'match');
  const item = levels[li].items[ii];
  await fresh(page, PC, startAt(li, ii));
  const card = (t: string) => page.getByRole('button', { name: t, exact: true });
  await card(item.pairs[0].left).click();
  await card(item.pairs[1].right).click();          // wrong
  await page.waitForTimeout(900);
  for (const p of item.pairs) { await card(p.left).click(); await card(p.right).click(); }
  await expect(page.getByText('✗ Not quite')).toBeVisible();
  await expect(page.getByText('Completed with 1 wrong tap.')).toBeVisible();
  await page.getByRole('button', { name: 'Continue →' }).click();
  expect((await stored(page)).results[String(li)]).toEqual([false]);
});

test('10. order: right only on the first try', async ({ page }) => {
  const li = levels.findIndex(l => l.items.some((i: any) => i.type === 'order'));
  const ii = levels[li].items.findIndex((i: any) => i.type === 'order');
  const item = levels[li].items[ii];
  const words: string[] = (item.words?.length ? item.words : item.correctSentence.split(/\s+/)).filter(Boolean);
  await fresh(page, PC, startAt(li, ii));
  const bank = (w: string) => page.locator('button.rounded-full.bg-white', { hasText: w }).filter({ hasText: new RegExp(`^${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first();
  for (const w of [...words].reverse()) await bank(w).click();          // the wrong order
  await page.getByRole('button', { name: 'Check' }).click();
  await page.getByRole('button', { name: /Try again/ }).click();
  for (const w of item.correctSentence.split(/\s+/)) await bank(w).click();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect.poll(async () => (await stored(page)).results[String(li)]?.[0]).toBe(false);   // right, but not first time
});

test('10. select (tap to mark) and a typed answer with selfCheck (compare panel)', async ({ page }) => {
  await fresh(page, 'fixture-marking');
  await page.getByRole('button', { name: /Exercise 1/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Exercise 1' });
  await expect(sheet).toBeVisible();
  // Screen 1: mark the topic sentence
  await sheet.getByText('Tap the', { exact: false }).waitFor();
  await sheet.getByRole('button', { name: /Laughter is good for you/ }).first().click();
  await sheet.getByRole('button', { name: 'Check' }).click();
  await expect(sheet.getByText('✓ Correct!')).toBeVisible();
  // Screen 2: write, then compare with the book
  await sheet.getByPlaceholder('Type your answer...').fill('Because it makes you sleep.', { timeout: 5000 });
  await sheet.getByRole('button', { name: 'Check' }).click();
  await expect(sheet.getByText('The book’s answer')).toBeVisible();
  await expect(sheet.getByText('It lowers stress.')).toBeVisible();
  await expect(sheet.getByText('Does yours say the same?')).toBeVisible();
  await sheet.getByRole('button', { name: 'Mine is different' }).click();
  await expect(sheet.getByText('1 / 2 correct (50%)')).toBeVisible();
  await sheet.getByRole('button', { name: /Done — back/ }).click();
  expect(await page.evaluate(() => localStorage.getItem('lf-exercise-done-fixture-marking-aaaaaaaaaaa1'))).toBe('1');
});

test('11. the pros/cons exercise: two chart screens, boxes under Pros and Cons, answers vary, no score; resumes after reload', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: /Exercise 1/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Exercise 1' });
  await expect(sheet.getByText('Long vacations', { exact: false }).first()).toBeVisible();
  await expect(sheet.getByText('Pros', { exact: true }).first()).toBeVisible();
  await expect(sheet.getByText('Cons', { exact: true }).first()).toBeVisible();
  await sheet.getByLabel('Answer Pros 1').fill('You can relax.');
  await sheet.getByRole('button', { name: 'Check' }).click();
  await expect(sheet.getByText(/Answers vary — the book’s examples?/)).toBeVisible();
  await sheet.getByRole('button', { name: 'Next' }).click();
  await expect(sheet.getByText('Short vacations', { exact: false }).first()).toBeVisible();
  // Resume: reload and open it again — the same (second) screen
  await page.reload();
  await page.getByRole('button', { name: /Exercise 1/ }).click();
  await expect(sheet.getByText('Short vacations', { exact: false }).first()).toBeVisible();
  await sheet.getByLabel('Answer Cons 1').fill('It goes by fast.');
  await sheet.getByRole('button', { name: 'Check' }).click();
  await sheet.getByRole('button', { name: 'Next' }).click();
  await expect(sheet.getByText('All done: 2 answered')).toBeVisible();
  await expect(sheet.getByText(/correct \(/)).toHaveCount(0);
  await sheet.getByRole('button', { name: /Done — back/ }).click();
  await expect(page.getByRole('button', { name: /Exercise 1/ }).locator('svg.text-emerald-600')).toBeVisible();   // done tick
});

test('12. assist: Arabic question text where present; grading unchanged', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: /English \+ عربي/ }).click();
  await page.getByRole('button', { name: /Multiple Choice/ }).click();
  const q = session.quiz[0];
  await expect(page.locator('[dir="rtl"]', { hasText: q.questionTextArabic.slice(0, 15) }).first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('lf-assist'))).toBe('1');
  await page.getByRole('button', { name: new RegExp(q.correctAnswer) }).first().click();
  await expect(page.getByText('✓ Correct!')).toBeVisible();
  await expect.poll(async () => (await stored(page)).results['0']).toEqual([true]);
  // The header switch turns it off again
  await page.getByRole('button', { name: 'Hide Arabic' }).first().click();
  expect(await page.evaluate(() => localStorage.getItem('lf-assist'))).toBe('0');
});

test('the completion screen and the module page remember the score', async ({ page }) => {
  // Start at the last standard-mode item
  const li = levels.length - 1;
  const ii = levels[li].items.length - 1;
  const item = levels[li].items[ii];
  await fresh(page, PC, startAt(li, ii));
  expect(item.type).toBe('mcq');
  await page.getByRole('button', { name: new RegExp(item.correctAnswer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click();
  await expect(page.getByText('All done! 🎉')).toBeVisible();
  // LessonForge's total is every item in the stream; only the last one was answered here
  const total = levels.reduce((n, l) => n + l.items.length, 0);
  await expect(page.getByText(`1 / ${total} correct (${Math.round(100 / total)}%)`)).toBeVisible();
  const p = await page.evaluate((id) => JSON.parse(localStorage.getItem(`lf-progress-${id}`) || '{}'), PC);
  expect(p.session.score).toEqual({ correct: 1, total });
});
