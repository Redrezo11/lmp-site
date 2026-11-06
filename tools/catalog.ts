/**
 * Rebuild public/catalog.json from the modules in public/modules:
 *
 *   npm run catalog
 *
 * Run it after adding, replacing or removing a module folder, then commit both.
 * Modules with errors are left out (and listed), so the site never offers one
 * that can't play.
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { readModule, moduleDirs } from './read';
import { validateModule } from '../src/lmp/validate';

export function buildCatalog(dirs = moduleDirs()) {
  const modules: any[] = [];
  const skipped: Array<{ dir: string; errors: string[] }> = [];
  for (const dir of dirs) {
    const m = readModule(dir);
    const r = validateModule(m.manifest, m.files, m.assetPaths);
    if (r.errors.length) { skipped.push({ dir, errors: r.errors }); continue; }
    const folder = `modules/${path.basename(dir)}/`;
    const mf = m.manifest;
    modules.push({
      id: mf.id, title: mf.title, description: mf.description, language: mf.language, languages: mf.languages || [mf.language],
      thumbnail: mf.thumbnail ? folder + mf.thumbnail : undefined, tags: mf.tags || [], profiles: mf.profiles || [],
      meta: { ...(mf.meta || {}), exportWarnings: undefined },
      path: folder, sizeBytes: m.sizeBytes,
      lessons: mf.lessons.map((l: any) => ({ id: l.id, title: l.title, kind: l.kind })),
      exportedAt: mf.generator?.exportedAt,
    });
  }
  modules.sort((a, b) => a.title.localeCompare(b.title));
  return { catalog: { generatedAt: new Date().toISOString(), modules }, skipped };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { catalog, skipped } = buildCatalog();
  fs.writeFileSync(path.join(process.cwd(), 'public', 'catalog.json'), JSON.stringify(catalog, null, 1) + '\n');
  console.log(`public/catalog.json: ${catalog.modules.length} module(s)`);
  for (const s of skipped) { console.log(`left out ${s.dir}:`); s.errors.forEach(e => console.log(`    ${e}`)); }
  process.exit(skipped.length ? 1 : 0);
}
