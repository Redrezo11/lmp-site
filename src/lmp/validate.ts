import Ajv2020Import from 'ajv/dist/2020.js';
import addFormatsImport from 'ajv-formats';
import type { ValidateFunction, ErrorObject } from 'ajv';
import manifestSchema from '../../schema/lmp-manifest.schema.json';
import commonSchema from '../../schema/lf-common.schema.json';
import presentationSchema from '../../schema/lf-presentation.schema.json';
import deckSchema from '../../schema/lf-deck.schema.json';
import exercisesSchema from '../../schema/lf-exercises.schema.json';
import sessionSchema from '../../schema/lf-student-session.schema.json';
import { MARKED_TYPES } from './types';

/**
 * Checks a module the way the format sheet §5 says: errors stop it playing,
 * warnings play with a notice. Every message names the file and the block.
 * Used by the site (before launch) and by tools/validate.ts (command line).
 * The schemas in /schema are copies of LessonForge's; don't edit them here.
 */

const Ajv2020: any = (Ajv2020Import as any).default || Ajv2020Import;
const addFormats: any = (addFormatsImport as any).default || addFormatsImport;

const SUPPORTED_MAJOR = 1;
const KNOWN_PROFILES = new Set(['lf/1']);
const CORE_TYPES = new Set(['text', 'image', 'audio', 'video', 'info', 'summary', ...MARKED_TYPES]);

let compiled: { manifest: ValidateFunction; blocks: Record<string, ValidateFunction> } | null = null;
function schemas() {
  if (compiled) return compiled;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  ajv.addSchema(commonSchema, 'lf-common.schema.json');
  const blocks: Record<string, ValidateFunction> = {};
  for (const [type, schema, name] of [
    ['lf.presentation', presentationSchema, 'lf-presentation.schema.json'],
    ['lf.deck', deckSchema, 'lf-deck.schema.json'],
    ['lf.exercises', exercisesSchema, 'lf-exercises.schema.json'],
    ['lf.student-session', sessionSchema, 'lf-student-session.schema.json'],
  ] as const) {
    ajv.addSchema(schema, name);
    blocks[type] = ajv.getSchema(name)!;
  }
  compiled = { manifest: ajv.compile(manifestSchema), blocks };
  return compiled;
}

export interface Report { errors: string[]; warnings: string[] }

const say = (where: string, errs: ErrorObject[] | null | undefined) =>
  (errs || []).slice(0, 6).map(e => `${where}${e.instancePath || ''}: ${e.message}`);

/**
 * `assetPaths`: every file in the package (for a .lmp or a folder on disk). Pass
 * null when they can't be listed (a module served from the site): asset checks
 * are then skipped and the browser reports missing files when they load.
 */
export function validateModule(manifest: any, files: Record<string, any>, assetPaths: Set<string> | null): Report {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { manifest: vm, blocks } = schemas();

  if (!manifest || typeof manifest !== 'object') return { errors: ['module.json: missing or not JSON'], warnings };
  if (manifest.format !== 'LMP') return { errors: ['module.json: this is not an LMP module ("format" must be "LMP")'], warnings };
  const major = Number(String(manifest.formatVersion || '').split('.')[0]);
  if (major > SUPPORTED_MAJOR) return { errors: [`module.json: format version ${manifest.formatVersion} is newer than this player understands (${SUPPORTED_MAJOR}.x)`], warnings };
  if (!vm(manifest)) errors.push(...say('module.json', vm.errors));
  for (const p of manifest.profiles || []) if (!KNOWN_PROFILES.has(p)) warnings.push(`module.json: profile "${p}" isn't known here; its blocks show as placeholders`);

  const ids = new Set<string>();
  for (const l of manifest.lessons || []) {
    const file = files[l.source];
    if (!file) { errors.push(`module.json: lesson "${l.id}" points at ${l.source}, which isn't in the package`); continue; }
    if (!Array.isArray(file.blocks)) { errors.push(`${l.source}: has no "blocks" list`); continue; }
    for (const b of file.blocks) {
      if (!b?.id || !b?.type) { errors.push(`${l.source}: a block without an id or a type`); continue; }
      if (ids.has(`${l.id}#${b.id}`)) errors.push(`${l.source}: two blocks are called "${b.id}"`);
      ids.add(`${l.id}#${b.id}`);
      const v = blocks[b.type];
      if (v) { if (!v(b)) warnings.push(...say(`${l.source} › ${b.id} (skipped)`, v.errors)); }
      else if (!CORE_TYPES.has(b.type)) warnings.push(`${l.source} › ${b.id}: block type "${b.type}" isn't known here; it shows as a placeholder`);
    }
  }
  if (!(manifest.lessons || []).some((l: any) => l.id === manifest.entry)) errors.push(`module.json: entry "${manifest.entry}" is not one of the lessons`);

  const walk = (v: any, where: string) => {
    if (Array.isArray(v)) { v.forEach(x => walk(x, where)); return; }
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (typeof x === 'string' && /Ref$/.test(k) && !ids.has(x)) errors.push(`${where}: ${k} "${x}" doesn't point at a block`);
        walk(x, where);
      }
      return;
    }
    if (assetPaths && typeof v === 'string' && v.startsWith('assets/') && !assetPaths.has(v)) errors.push(`${where}: ${v} isn't in the package`);
  };
  for (const [p, f] of Object.entries(files)) walk(f, p);
  if (assetPaths && typeof manifest.thumbnail === 'string' && manifest.thumbnail.startsWith('assets/') && !assetPaths.has(manifest.thumbnail)) errors.push(`module.json: thumbnail ${manifest.thumbnail} isn't in the package`);
  for (const w of manifest.meta?.exportWarnings || []) warnings.push(`From the export: ${w}`);
  return { errors, warnings };
}
