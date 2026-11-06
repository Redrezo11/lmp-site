import fs from 'fs';
import path from 'path';
import { unzipSync, strFromU8 } from 'fflate';

/** A module from disk (a folder or a .lmp file), for the command-line tools and the tests */
export interface DiskModule { manifest: any; files: Record<string, any>; assetPaths: Set<string>; sizeBytes: number }

const walk = (dir: string, base = dir): string[] => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join('/')]));

export function readModule(where: string): DiskModule {
  let read: (rel: string) => string | undefined;
  let names: string[];
  let sizeBytes = 0;
  if (fs.statSync(where).isDirectory()) {
    names = walk(where);
    for (const n of names) sizeBytes += fs.statSync(path.join(where, n)).size;
    read = rel => (fs.existsSync(path.join(where, rel)) ? fs.readFileSync(path.join(where, rel), 'utf8') : undefined);
  } else {
    const buf = fs.readFileSync(where);
    sizeBytes = buf.length;
    const entries = unzipSync(new Uint8Array(buf));
    const all = Object.keys(entries).filter(n => !n.endsWith('/'));
    const root = all.includes('module.json') ? '' : (all.find(n => /^[^/]+\/module\.json$/.test(n)) || '').replace('module.json', '');
    names = all.filter(n => n.startsWith(root)).map(n => n.slice(root.length));
    read = rel => (entries[root + rel] ? strFromU8(entries[root + rel]) : undefined);
  }
  const json = (rel: string) => { const t = read(rel); try { return t === undefined ? undefined : JSON.parse(t); } catch { return undefined; } };
  const manifest = json('module.json');
  const files: Record<string, any> = {};
  for (const l of manifest?.lessons || []) { const f = json(l.source); if (f) files[l.source] = f; }
  return { manifest, files, assetPaths: new Set(names.filter(n => n.startsWith('assets/'))), sizeBytes };
}

export const MODULES_DIR = path.join(process.cwd(), 'public', 'modules');
export const moduleDirs = () => (fs.existsSync(MODULES_DIR) ? fs.readdirSync(MODULES_DIR, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => path.join(MODULES_DIR, e.name)) : []);
