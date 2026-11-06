import { useSyncExternalStore } from 'react';

/**
 * "Assisted" language support for student exercises.
 *
 * Students told us they prefer English-only, so ENGLISH IS THE DEFAULT and the
 * Arabic overlay is opt-in. Assist mode never changes WHAT is asked or how it
 * is graded — the English question/options remain the answer spine; Arabic is
 * layered on top for students who need it.
 *
 * Module-level store (not context) so the entry picker and the in-session
 * toggle stay in sync without a provider, and the choice carries across the
 * assess → practice hand-off and between lessons.
 */
const KEY = 'lf-assist';

const listeners = new Set<() => void>();
let assist: boolean = read();

function read(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function setAssist(on: boolean) {
  if (assist === on) return;
  assist = on;
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode — session-only */ }
  listeners.forEach(l => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** true when the student opted into the Arabic overlay. */
export function useAssist(): boolean {
  return useSyncExternalStore(subscribe, () => assist, () => false);
}
