import { unzipSync, strFromU8 } from 'fflate';
import type { LoadedModule, Manifest, LessonFile } from './types';
import { validateModule } from './validate';

/**
 * Getting modules: the site's own (public/modules, listed in public/catalog.json)
 * and .lmp files the visitor imports (read in the browser, never uploaded).
 */

export interface CatalogEntry {
  id: string;
  title: string;
  description?: string;
  language: string;
  languages?: string[];
  thumbnail?: string;
  tags?: string[];
  profiles?: string[];
  meta?: Record<string, unknown>;
  path: string;
  sizeBytes?: number;
  lessons: Array<{ id: string; title: string; kind?: string }>;
  exportedAt?: string;
}
export interface Catalog { generatedAt: string; modules: CatalogEntry[] }

export class ModuleError extends Error {
  constructor(public errors: string[], public warnings: string[] = []) { super(errors[0] || 'This module cannot be played'); }
}

export async function loadCatalog(): Promise<Catalog> {
  const res = await fetch('catalog.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('The catalogue (catalog.json) could not be loaded');
  return res.json();
}

/** A module in public/modules/<id>/ */
export async function loadSiteModule(entry: CatalogEntry): Promise<LoadedModule> {
  const base = entry.path.endsWith('/') ? entry.path : `${entry.path}/`;
  const getJson = async (p: string) => {
    const r = await fetch(base + p, { cache: 'no-cache' });
    if (!r.ok) throw new ModuleError([`${p}: not found (${r.status})`]);
    return r.json();
  };
  const manifest: Manifest = await getJson('module.json');
  const files: Record<string, LessonFile> = {};
  for (const l of manifest.lessons || []) files[l.source] = await getJson(l.source).catch(() => undefined as any);
  for (const k of Object.keys(files)) if (!files[k]) delete files[k];
  const report = validateModule(manifest, files, null);
  if (report.errors.length) throw new ModuleError(report.errors, report.warnings);
  return { manifest, files, origin: 'site', warnings: report.warnings, resolve: p => (/^(https?:|blob:|data:)/.test(p) ? p : base + p) };
}

// Imported modules live for this visit (phase 3 keeps them in IndexedDB)
const imported = new Map<string, LoadedModule>();
export const importedModule = (id: string) => imported.get(id) || null;
export const importedModules = () => [...imported.values()];

const MIME: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', json: 'application/json', mp4: 'video/mp4', webm: 'video/webm', vtt: 'text/vtt' };

/** Read a .lmp (zip) the visitor chose; module.json at the root or one folder down */
export async function importLmp(file: File): Promise<LoadedModule> {
  let entries: Record<string, Uint8Array>;
  try { entries = unzipSync(new Uint8Array(await file.arrayBuffer())); }
  catch { throw new ModuleError([`${file.name}: not a zip file (.lmp files are zips)`]); }
  const names = Object.keys(entries).filter(n => !n.endsWith('/'));
  const root = names.includes('module.json') ? '' : (names.find(n => /^[^/]+\/module\.json$/.test(n)) || '').replace('module.json', '');
  if (!names.includes(`${root}module.json`)) throw new ModuleError([`${file.name}: no module.json inside`]);
  const rel = (n: string) => n.slice(root.length);
  const json = (n: string) => { try { return JSON.parse(strFromU8(entries[root + n])); } catch { return undefined; } };
  const manifest: Manifest = json('module.json');
  const files: Record<string, LessonFile> = {};
  for (const l of manifest?.lessons || []) { const f = json(l.source); if (f) files[l.source] = f; }
  const assetPaths = new Set(names.filter(n => n.startsWith(root)).map(rel).filter(n => n.startsWith('assets/')));
  const report = validateModule(manifest, files, assetPaths);
  if (report.errors.length) throw new ModuleError(report.errors, report.warnings);
  const urls = new Map<string, string>();
  for (const p of assetPaths) {
    const ext = p.split('.').pop()?.toLowerCase() || '';
    const bytes = entries[root + p];
    urls.set(p, URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: MIME[ext] || 'application/octet-stream' })));
  }
  const old = imported.get(manifest.id);
  if (old) revoke(old);
  const mod: LoadedModule = { manifest, files, origin: 'imported', warnings: report.warnings, resolve: p => urls.get(p) || p };
  (mod as any).urls = urls;
  imported.set(manifest.id, mod);
  return mod;
}

function revoke(m: LoadedModule) {
  for (const u of ((m as any).urls as Map<string, string> | undefined)?.values() || []) URL.revokeObjectURL(u);
}

export function removeImported(id: string) {
  const m = imported.get(id);
  if (m) revoke(m);
  imported.delete(id);
}
