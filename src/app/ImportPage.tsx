import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, AlertTriangle } from 'lucide-react';
import { importLmp, ModuleError } from '../lmp/load';

/**
 * Open a .lmp file from this computer (website-spec §7.2). It is read in the
 * browser and never uploaded. It lasts for this visit; keeping it after a reload
 * (IndexedDB) is phase 3.
 */
export function ImportPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const open = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true); setErrors([]);
    try {
      const mod = await importLmp(file);
      navigate(`/m/${mod.manifest.id}`);
    } catch (e) {
      setErrors(e instanceof ModuleError ? e.errors : [e instanceof Error ? e.message : 'This file could not be opened']);
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Import a module</h1>
      <p className="text-slate-600">Choose a <b>.lmp</b> file, for example one exported from LessonForge. It opens here without being uploaded anywhere, and lasts until you close or reload this page.</p>
      <label className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 cursor-pointer ${busy ? 'border-slate-200 bg-slate-50' : 'border-indigo-300 bg-white hover:bg-indigo-50'}`}
        onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); open(e.dataTransfer.files[0]); }}>
        <Upload className="w-8 h-8 text-indigo-600" />
        <span className="font-semibold text-slate-900">{busy ? 'Opening…' : 'Choose a .lmp file'}</span>
        <span className="text-sm text-slate-500">or drop it here</span>
        <input type="file" accept=".lmp,.zip,application/zip" className="sr-only" disabled={busy} onChange={e => open(e.target.files?.[0])} />
      </label>
      {errors.length > 0 && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4" />This file can't be played</p>
          <ul className="mt-2 list-disc pl-6 space-y-0.5">{errors.map((e, i) => <li key={i}><code className="break-all">{e}</code></li>)}</ul>
        </div>
      )}
    </div>
  );
}
