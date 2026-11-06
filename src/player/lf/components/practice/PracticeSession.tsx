import { useState, useEffect, useCallback, useRef } from 'react';
import { BookOpen, RotateCcw, ChevronRight } from 'lucide-react';
import { PracticeSet, PracticeLevel, PracticeItem, BloomLevel } from '../../types/practice';
import { MatchExercise } from './MatchExercise';
import { McqExercise } from './McqExercise';
import { OrderExercise } from './OrderExercise';
import { TypedExercise } from './TypedExercise';
import { MarkTextExercise } from './MarkTextExercise';

export type PracticeMode = 'standard' | 'challenge';
type Phase = 'intro' | 'item' | 'levelSummary' | 'done';

export const BLOOM_CHIP: Record<BloomLevel, string> = {
  quiz: 'bg-indigo-100 text-indigo-700',
  remember: 'bg-sky-100 text-sky-700',
  understand: 'bg-teal-100 text-teal-700',
  apply: 'bg-indigo-100 text-indigo-700',
  analyze: 'bg-violet-100 text-violet-700',
  challenge: 'bg-amber-100 text-amber-700',
};

interface PracticeSessionProps {
  set: PracticeSet;
  /** Mode for a fresh session; a resumed session keeps its stored mode */
  initialMode: PracticeMode;
  storageKey: string;
  /** Skip level-intro screens — used by the seamless embedded flow */
  skipIntros?: boolean;
  canReview: boolean;
  resolveSlide: (item: PracticeItem) => number | null;
  onOpenSlide: (index: number) => void;
  /** Standalone page: called by "Start over" to return to the mode picker */
  onExit?: () => void;
  /** Reports whole-session progress (completed items, mode-visible total) */
  onProgress?: (completed: number, total: number) => void;
  /**
   * Continuous mode: no between-level summary screens (each was a mini finish
   * line that made students think they were done) — levels flow straight on.
   */
  continuous?: boolean;
  /** Fired once when the whole session finishes — the only score moment */
  onComplete?: (summary: SessionSummary) => void;
  /**
   * Where the resume state lives. sessionStorage (default) for the class QR
   * session; localStorage for a student studying at home, whose phone drops the
   * tab between sittings.
   */
  storage?: Storage;
}

export interface SessionSummary {
  levels: Array<{ level: BloomLevel; label: string; correct: number; total: number }>;
  correct: number;
  total: number;
}

/**
 * The practice session engine: Bloom-level sequencer with immediate-feedback
 * exercises, level scores, and a final summary. Shared between the standalone
 * /practice page and the seamless in-assessment flow (which starts it with
 * zero presses via skipIntros).
 */
export function PracticeSession({ set, initialMode, storageKey, skipIntros, canReview, resolveSlide, onOpenSlide, onExit, onProgress, continuous, onComplete, storage }: PracticeSessionProps) {
  const store = () => storage ?? sessionStorage;
  const [mode, setMode] = useState<PracticeMode>(initialMode);
  const [phase, setPhase] = useState<Phase>(skipIntros ? 'item' : 'intro');
  const [levelIndex, setLevelIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const [results, setResults] = useState<Record<number, boolean[]>>({});
  const [epoch, setEpoch] = useState(0);
  const [restored, setRestored] = useState(false);

  // Resume (stored mode wins over initialMode so a session resumes as started)
  useEffect(() => {
    try {
      const saved = store().getItem(storageKey);
      if (saved) {
        const p = JSON.parse(saved);
        if (p.mode === 'standard' || p.mode === 'challenge') {
          const visible = set.levels.filter(l => p.mode === 'challenge' || l.level !== 'challenge');
          if (typeof p.levelIndex === 'number' && p.levelIndex < visible.length) {
            const items = visible[p.levelIndex]?.items || [];
            setMode(p.mode);
            setLevelIndex(p.levelIndex);
            setItemIndex(Math.min(typeof p.itemIndex === 'number' ? p.itemIndex : 0, Math.max(0, items.length - 1)));
            setPhase(p.phase === 'done' ? 'done' : p.phase === 'levelSummary' ? 'levelSummary' : 'item');
            if (p.results && typeof p.results === 'object') setResults(p.results);
          }
        }
      }
    } catch { /* fresh start */ }
    setRestored(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist
  useEffect(() => {
    if (!restored) return;
    try {
      store().setItem(storageKey, JSON.stringify({ mode, phase, levelIndex, itemIndex, results }));
    } catch { /* storage unavailable */ }
  }, [mode, phase, levelIndex, itemIndex, results, storageKey, restored]);

  const visibleLevels: PracticeLevel[] = set.levels.filter(l => mode === 'challenge' || l.level !== 'challenge');
  const hasChallengeLevel = set.levels.some(l => l.level === 'challenge');

  // Report whole-session progress to the host page (drives the combined
  // assessment + practice progress bar)
  useEffect(() => {
    if (!onProgress || !restored) return;
    const total = visibleLevels.reduce((n, l) => n + l.items.length, 0);
    const completed = Object.values(results).reduce(
      (n, arr) => n + (Array.isArray(arr) ? arr.filter(v => typeof v === 'boolean').length : 0), 0);
    onProgress(Math.min(completed, total), total);
  }, [results, mode, restored]); // eslint-disable-line react-hooks/exhaustive-deps
  const currentLevel = visibleLevels[levelIndex];
  const currentItem = currentLevel?.items[itemIndex];

  const handleItemComplete = useCallback((result: { correct: boolean }) => {
    setResults(prev => {
      const arr = [...(prev[levelIndex] || [])];
      arr[itemIndex] = result.correct;
      return { ...prev, [levelIndex]: arr };
    });
    if (currentLevel && itemIndex + 1 < currentLevel.items.length) {
      setItemIndex(i => i + 1);
    } else if (continuous) {
      // No mini finish line between levels — flow straight into the next one
      if (levelIndex + 1 < visibleLevels.length) {
        setLevelIndex(l => l + 1);
        setItemIndex(0);
        setPhase('item');
      } else {
        setPhase('done');
      }
    } else {
      setPhase('levelSummary');
    }
  }, [levelIndex, itemIndex, currentLevel, continuous, visibleLevels.length]);

  const nextLevel = () => {
    if (levelIndex + 1 < visibleLevels.length) {
      setLevelIndex(l => l + 1);
      setItemIndex(0);
      setPhase(skipIntros ? 'item' : 'intro');
    } else {
      setPhase('done');
    }
  };

  const retryLevel = () => {
    setResults(prev => ({ ...prev, [levelIndex]: [] }));
    setItemIndex(0);
    setPhase('item');
    setEpoch(e => e + 1);
  };

  const restartInMode = (m: PracticeMode) => {
    setMode(m);
    setPhase(skipIntros ? 'item' : 'intro');
    setLevelIndex(0);
    setItemIndex(0);
    setResults({});
    setEpoch(e => e + 1);
  };

  const handleStartOver = () => {
    try { store().removeItem(storageKey); } catch { /* ignore */ }
    if (onExit) onExit();
    else restartInMode(mode);
  };

  // Answers vary: nothing was marked, so there is no score to show
  const notMarked = visibleLevels.every(l => l.items.every(i => (i.type === 'typed' || i.type === 'select') && i.vary));
  const levelScore = (idx: number): { correct: number; total: number } => {
    const arr = results[idx] || [];
    return { correct: arr.filter(Boolean).length, total: visibleLevels[idx]?.items.length || 0 };
  };

  // The session's one and only score moment — report it to the host page
  const completeReportedRef = useRef(false);
  useEffect(() => {
    if (phase !== 'done' || !onComplete || completeReportedRef.current) return;
    completeReportedRef.current = true;
    const levels = visibleLevels.map((l, idx) => {
      const s = levelScore(idx);
      return { level: l.level, label: l.label, correct: s.correct, total: s.total };
    });
    onComplete({
      levels,
      correct: levels.reduce((n, l) => n + l.correct, 0),
      total: levels.reduce((n, l) => n + l.total, 0),
    });
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!restored || !currentLevel) return null;

  const slideIdx = currentItem ? resolveSlide(currentItem) : null;

  return (
    <div>
      {/* Level intro (standalone flow only) */}
      {phase === 'intro' && (
        <div className="p-5 max-w-lg mx-auto text-center space-y-4">
          <p className="text-xs text-slate-400 mt-2">Level {levelIndex + 1} of {visibleLevels.length}</p>
          <div className="flex items-center justify-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${BLOOM_CHIP[currentLevel.level]}`}>{currentLevel.label}</span>
            {currentLevel.labelArabic && (
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${BLOOM_CHIP[currentLevel.level]}`} dir="rtl" lang="ar">{currentLevel.labelArabic}</span>
            )}
          </div>
          <p className="text-sm text-slate-500">{currentLevel.items.length} exercise{currentLevel.items.length !== 1 ? 's' : ''}</p>
          <button
            onClick={() => setPhase('item')}
            className="w-full py-3 rounded-xl font-semibold text-white bg-indigo-600 active:bg-indigo-700 flex items-center justify-center gap-1"
          >
            Start <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Exercise */}
      {phase === 'item' && currentItem && (
        <div className="max-w-lg mx-auto pt-2">
          <div className="px-4 pb-2 flex items-center justify-between">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${BLOOM_CHIP[currentLevel.level]}`}>
              {currentLevel.label}{currentLevel.labelArabic ? ` · ${currentLevel.labelArabic}` : ''}
            </span>
            <span className="text-xs text-slate-400">Level {levelIndex + 1}/{visibleLevels.length} · {itemIndex + 1}/{currentLevel.items.length}</span>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 mx-3 pt-3 overflow-hidden">
            {(() => {
              const key = `${epoch}:${mode}:${levelIndex}:${itemIndex}`;
              switch (currentItem.type) {
                case 'match': return <MatchExercise key={key} item={currentItem} onComplete={handleItemComplete} />;
                case 'mcq': return <McqExercise key={key} item={currentItem} onComplete={handleItemComplete} typedMode={mode === 'challenge' && !!currentItem.typedEligible} />;
                case 'order': return <OrderExercise key={key} item={currentItem} onComplete={handleItemComplete} />;
                case 'typed': return <TypedExercise key={key} item={currentItem} onComplete={handleItemComplete} />;
                case 'select': return <MarkTextExercise key={key} item={currentItem} onComplete={handleItemComplete} />;
                default: return null;
              }
            })()}
          </div>
          {canReview && slideIdx !== null && (
            <button
              onClick={() => onOpenSlide(slideIdx)}
              className="mx-3 mt-2 px-3 py-2 rounded-lg bg-indigo-50 active:bg-indigo-100 border border-indigo-100 text-left block w-[calc(100%-1.5rem)]"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium text-indigo-600">
                <BookOpen className="w-3.5 h-3.5 shrink-0" /> Need help? Tap to see the lesson slide for this exercise
              </span>
              <span className="block text-xs text-indigo-600 text-right mt-1" dir="rtl" lang="ar">
                تحتاج مساعدة؟ اضغط هنا لعرض الشريحة التي تشرح هذا التمرين
              </span>
            </button>
          )}
        </div>
      )}

      {/* Level summary */}
      {phase === 'levelSummary' && (
        <div className="p-5 max-w-lg mx-auto text-center space-y-4">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-2 ${BLOOM_CHIP[currentLevel.level]}`}>{currentLevel.label} — complete</span>
          {(() => {
            const s = levelScore(levelIndex);
            const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
            return (
              <div className={`py-4 rounded-xl font-bold text-lg ${pct >= 70 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {s.correct} / {s.total} correct ({pct}%)
              </div>
            );
          })()}
          <div className="flex gap-2">
            <button onClick={retryLevel} className="flex-1 py-3 rounded-xl font-semibold bg-slate-100 text-slate-700 active:bg-slate-200 flex items-center justify-center gap-1.5">
              <RotateCcw className="w-4 h-4" /> Retry level
            </button>
            <button onClick={nextLevel} className="flex-1 py-3 rounded-xl font-semibold text-white bg-indigo-600 active:bg-indigo-700">
              {levelIndex + 1 < visibleLevels.length ? 'Next level →' : 'Finish'}
            </button>
          </div>
        </div>
      )}

      {/* Final summary */}
      {phase === 'done' && (
        <div className="p-5 max-w-lg mx-auto space-y-4">
          <h2 className="text-center text-lg font-bold text-slate-800 mt-2">All done! 🎉</h2>
          {(() => {
            const correct = visibleLevels.reduce((n, _l, idx) => n + levelScore(idx).correct, 0);
            const total = visibleLevels.reduce((n, _l, idx) => n + levelScore(idx).total, 0);
            const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
            return (
              <div className={`py-4 rounded-xl text-center font-bold text-xl ${pct >= 70 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {notMarked ? `All done: ${total} answered` : `${correct} / ${total} correct (${pct}%)`}
                <p className="text-sm font-medium mt-0.5" dir="rtl" lang="ar">أنهيت كل الأسئلة والتدريبات</p>
              </div>
            );
          })()}
          {!notMarked && <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
            {visibleLevels.map((l, idx) => {
              const s = levelScore(idx);
              const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
              return (
                <div key={idx} className="flex items-center justify-between px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${BLOOM_CHIP[l.level]}`}>{l.label}</span>
                  <span className={`text-sm font-semibold ${pct >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>{s.correct}/{s.total}</span>
                </div>
              );
            })}
          </div>}
          {mode === 'standard' && hasChallengeLevel && (
            <button onClick={() => restartInMode('challenge')} className="w-full py-3 rounded-xl font-semibold text-amber-800 bg-amber-100 active:bg-amber-200">
              ✍ Try Challenge mode — with writing questions
            </button>
          )}
          <button onClick={handleStartOver} className="w-full py-3 rounded-xl font-semibold bg-slate-100 text-slate-700 active:bg-slate-200 flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4" /> Start over
          </button>
        </div>
      )}
    </div>
  );
}
