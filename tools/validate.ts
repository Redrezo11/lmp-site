/**
 * Check modules the way the site does, from the command line:
 *
 *   npm run validate                         every folder in public/modules
 *   npm run validate -- path/to/module.lmp   one file or folder
 *
 * Exit code 1 when any module has an error (warnings don't fail).
 */
import { readModule, moduleDirs } from './read';
import { validateModule } from '../src/lmp/validate';

const targets = process.argv.slice(2).length ? process.argv.slice(2) : moduleDirs();
if (!targets.length) { console.log('No modules found in public/modules.'); process.exit(0); }
let failed = 0;
for (const t of targets) {
  const m = readModule(t);
  const r = validateModule(m.manifest, m.files, m.assetPaths);
  const name = m.manifest?.id || t;
  if (r.errors.length) { failed++; console.log(`✗ ${name}`); r.errors.forEach(e => console.log(`    error: ${e}`)); }
  else console.log(`✓ ${name} (${(m.sizeBytes / 1e6).toFixed(1)} MB, ${m.assetPaths.size} files)`);
  r.warnings.forEach(w => console.log(`    note: ${w}`));
}
process.exit(failed ? 1 : 0);
