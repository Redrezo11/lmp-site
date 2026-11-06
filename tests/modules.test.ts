/**
 * The modules this site ships, and the checks that protect it: every module in
 * public/modules passes the format check; broken ones are caught with a message
 * that names the file; the catalogue lists exactly the playable ones.
 */
import path from 'path';
import { describe, it, expect } from 'vitest';
import { readModule, moduleDirs } from '../tools/read';
import { buildCatalog } from '../tools/catalog';
import { validateModule } from '../src/lmp/validate';

const dirs = moduleDirs();
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe('the shipped modules', () => {
  it('there is at least one', () => { expect(dirs.length).toBeGreaterThan(0); });
  for (const dir of dirs) {
    it(`${path.basename(dir)} passes the format check`, () => {
      const m = readModule(dir);
      expect(validateModule(m.manifest, m.files, m.assetPaths).errors).toEqual([]);
    });
  }
  it('the catalogue lists every one of them', () => {
    const { catalog, skipped } = buildCatalog(dirs);
    expect(skipped).toEqual([]);
    expect(catalog.modules.map(m => m.path).sort()).toEqual(dirs.map(d => `modules/${path.basename(d)}/`).sort());
    for (const m of catalog.modules) expect(m.lessons.length).toBeGreaterThan(0);
  });
});

describe('what the check catches', () => {
  const m = readModule(dirs.find(d => readModule(d).manifest.profiles?.includes('lf/1')) || dirs[0]);
  it('a file missing from the package, by name', () => {
    const some = [...m.assetPaths];
    const gone = some[0];
    const r = validateModule(m.manifest, m.files, new Set(some.slice(1)));
    expect(r.errors.join('\n')).toContain(`${gone} isn't in the package`);
  });
  it('a reference to a block that isn\'t there', () => {
    const files = clone(m.files);
    const first = Object.keys(files)[0];
    files[first].blocks[0].exercisesRef = 'nowhere#x';
    expect(validateModule(m.manifest, files, m.assetPaths).errors.join()).toContain("doesn't point at a block");
  });
  it('a newer format than this player understands', () => {
    const r = validateModule({ ...m.manifest, formatVersion: '2.0' }, m.files, m.assetPaths);
    expect(r.errors[0]).toContain('newer than this player');
  });
  it('an unknown block type is a note, not an error', () => {
    const files = clone(m.files);
    const first = Object.keys(files)[0];
    files[first].blocks.push({ id: 'zz', type: 'lf.something-new' });
    const r = validateModule(m.manifest, files, m.assetPaths);
    expect(r.errors).toEqual([]);
    expect(r.warnings.join()).toContain('lf.something-new');
  });
  it('an entry that isn\'t a lesson', () => {
    expect(validateModule({ ...m.manifest, entry: 'nope' }, m.files, m.assetPaths).errors.join()).toContain('entry "nope"');
  });
});
