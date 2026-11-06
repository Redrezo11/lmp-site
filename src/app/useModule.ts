import { useEffect, useState } from 'react';
import type { LoadedModule } from '../lmp/types';
import { loadCatalog, loadSiteModule, importedModule, ModuleError } from '../lmp/load';

export type ModuleState =
  | { status: 'loading' }
  | { status: 'error'; errors: string[]; warnings: string[] }
  | { status: 'ready'; mod: LoadedModule };

// One copy per visit, whatever page asks for it
const cache = new Map<string, Promise<LoadedModule>>();

/** A module by id: one imported in this visit, else the site's own from the catalogue */
export function useModule(id: string): ModuleState {
  const [state, setState] = useState<ModuleState>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    const imported = importedModule(id);
    if (imported) { setState({ status: 'ready', mod: imported }); return; }
    if (!cache.has(id)) {
      cache.set(id, loadCatalog().then(cat => {
        const entry = cat.modules.find(m => m.id === id);
        if (!entry) throw new ModuleError([`There is no module called "${id}" on this site.`]);
        return loadSiteModule(entry);
      }));
    }
    cache.get(id)!.then(
      mod => { if (live) setState({ status: 'ready', mod }); },
      err => {
        cache.delete(id);
        if (live) setState({ status: 'error', errors: err instanceof ModuleError ? err.errors : [String(err?.message || err)], warnings: err instanceof ModuleError ? err.warnings : [] });
      },
    );
    return () => { live = false; };
  }, [id]);
  return state;
}
