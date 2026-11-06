/**
 * The rest of the site still works around the LessonForge players: the
 * catalogue, a generic (core-blocks) module in the lesson frame, and "Start
 * again" clearing everything the players keep for a module (website-spec §8).
 */
import { test, expect } from '@playwright/test';
import { PC } from './support';

test('the catalogue lists both modules; a LessonForge lesson opens full screen from the module page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Critical Thinking: Identifying Pros and Cons' })).toBeVisible();
  await page.goto(`/#/m/${PC}`);
  await page.getByRole('link', { name: /^Student session/ }).click();
  await expect(page).toHaveURL(new RegExp(`#/m/${PC}/session$`));
  await expect(page.getByText('Exercises from the book (1)')).toBeVisible();
});

test('a generic module still plays in the lesson frame', async ({ page }) => {
  await page.goto('/#/m/sample-generic-blocks');
  await page.getByRole('link', { name: /^A tour of the block types/ }).click();
  await expect(page.getByText('1 / 12')).toBeVisible();
  await expect(page.getByRole('progressbar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to the module' })).toBeVisible();
});

test('"Start again" clears every key the players keep for the module', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((id) => {
    localStorage.setItem(`lf-progress-${id}`, JSON.stringify({ session: { visited: true, done: [], correct: [], lf: { lang: 'en', mode: 'choice' } } }));
    localStorage.setItem(`lf-session-${id}`, '{}');
    localStorage.setItem(`lf-exercise-${id}-db149de6c7b1`, '{}');
    localStorage.setItem(`lf-exercise-done-${id}-db149de6c7b1`, '1');
    localStorage.setItem('presenterPlaybackRates', '{"en":0.8,"ar":1}');
  }, PC);
  await page.goto(`/#/m/${PC}`);
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: 'Start again' }).click();
  const left = await page.evaluate((id) => Object.keys(localStorage).filter(k => k.includes(id)), PC);
  expect(left).toEqual([]);
  // device preferences are not the module's and stay
  expect(await page.evaluate(() => localStorage.getItem('presenterPlaybackRates'))).toBe('{"en":0.8,"ar":1}');
});
