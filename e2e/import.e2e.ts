/**
 * Checklist items 13–14 (website-spec §10), the parts that exist in phase 2:
 * an imported .lmp plays like the repository copy, a missing file is named,
 * an unknown block type is a note and a placeholder. (Keeping imports across
 * reloads in IndexedDB, and removing them, is phase 3.) And: nothing the site
 * does sends a request to another website.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { zipSync } from 'fflate';
import { test, expect, Page } from '@playwright/test';
import { PC, installProbes, audioState } from './support';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'public', 'modules', PC);

function walk(d: string, base = d): string[] {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name), base) : [path.relative(base, path.join(d, e.name)).split(path.sep).join('/')]));
}

/** The module as a .lmp, optionally changed on the way */
function lmp(out: string, change?: (files: Record<string, Uint8Array>) => void): string {
  const files: Record<string, Uint8Array> = {};
  for (const rel of walk(dir)) files[rel] = new Uint8Array(fs.readFileSync(path.join(dir, rel)));
  change?.(files);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, zipSync(files));
  return out;
}
const tmp = (name: string) => path.join(root, 'test-results', 'lmp', name);

async function importFile(page: Page, file: string) {
  await page.goto('/#/import');
  await page.locator('input[type=file]').setInputFiles(file);
}

test('13. an imported .lmp plays like the repository copy (blob: audio, same slides)', async ({ page }) => {
  await installProbes(page);
  await importFile(page, lmp(tmp('whole.lmp')));
  await expect(page.getByRole('heading', { name: 'Critical Thinking: Identifying Pros and Cons' })).toBeVisible();
  await page.getByRole('link', { name: /^Lesson /i }).click();
  await expect(page.getByText('1 / 5')).toBeVisible();
  await page.keyboard.press(' ');
  await page.getByRole('button', { name: /English/ }).click();
  await expect.poll(async () => (await audioState(page))?.src || '').toMatch(/^blob:/);
  await expect.poll(async () => (await audioState(page))?.t || 0).toBeGreaterThan(0.3);
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(page.locator('img[src^="blob:"]').first()).toBeVisible();   // the exercise picture from the package
});

test('14. a file missing from the package is named; the module does not open', async ({ page }) => {
  await importFile(page, lmp(tmp('missing.lmp'), f => { delete f['assets/audio/en/slide-3.mp3']; }));
  await expect(page.getByRole('alert')).toContainText('assets/audio/en/slide-3.mp3');
});

test('14. an unknown block type is a note and a placeholder; the rest still plays', async ({ page }) => {
  await importFile(page, lmp(tmp('unknown.lmp'), f => {
    const m = JSON.parse(Buffer.from(f['module.json']).toString('utf8'));
    m.lessons.push({ id: 'extra', title: 'Something new', source: 'content/extra.json' });
    f['module.json'] = new Uint8Array(Buffer.from(JSON.stringify(m)));
    f['content/extra.json'] = new Uint8Array(Buffer.from(JSON.stringify({ id: 'extra', title: 'Something new', blocks: [{ id: 'x', type: 'acme.hologram' }] })));
  }));
  await expect(page.getByText(/note.* about this module/)).toBeVisible();
  await page.getByRole('link', { name: 'Something new' }).click();
  await expect(page.getByText('This part needs a player that understands')).toBeVisible();
  await expect(page.getByText('acme.hologram')).toBeVisible();
});

test('no request leaves the site: catalogue, presenter, phone player, session, fonts', async ({ page }) => {
  const foreign: string[] = [];
  const fonts: string[] = [];
  page.on('request', r => {
    const u = r.url();
    if (/\.woff2$/.test(u)) fonts.push(u);
    if (!u.startsWith('http://localhost:4173/') && !/^(data|blob):/.test(u)) foreign.push(u);
  });
  await installProbes(page);
  await page.goto('/');
  await page.getByText('Critical Thinking: Identifying Pros and Cons').first().waitFor();
  await page.goto(`/#/m/${PC}/presentation`);
  await page.getByText('1 / 5').waitFor();
  await page.keyboard.press(' ');
  await page.getByRole('button', { name: /English/ }).click();
  await expect.poll(async () => (await audioState(page))?.t || 0).toBeGreaterThan(0.3);
  await page.keyboard.press('l');
  await page.keyboard.press(' ');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/#/m/${PC}/presentation`);
  await page.getByText('Slide 1 of 4').waitFor();
  await page.goto(`/#/m/${PC}/session`);
  await page.getByText('Exercises from the book (1)').waitFor();
  await page.waitForTimeout(500);
  expect(foreign).toEqual([]);
  expect(fonts.length).toBeGreaterThan(0);   // the slide fonts came from /fonts
  expect(fonts.every(u => u.startsWith('http://localhost:4173/fonts/'))).toBe(true);
});
