import { useState, useMemo, useEffect, useRef } from 'react';
import { OrderItem } from '../../types/practice';
import { FeedbackPanel } from './FeedbackPanel';

interface Tile {
  key: number; // index — duplicate words remain distinct tiles
  word: string;
}

interface OrderExerciseProps {
  item: OrderItem;
  onComplete: (result: { correct: boolean; attempts: number }) => void;
}

function scramble(tiles: Tile[]): Tile[] {
  if (tiles.length < 2) return tiles;
  const original = tiles.map(t => t.word).join(' ');
  const allSame = tiles.every(t => t.word.toLowerCase() === tiles[0].word.toLowerCase());
  for (let tries = 0; tries < 10; tries++) {
    const a = [...tiles];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (allSame || a.map(t => t.word).join(' ') !== original) return a;
  }
  return [...tiles].reverse();
}

/**
 * Word re-arrangement (tap-to-build): scrambled word tiles in a bank; tap a
 * tile to append it to the answer row, tap a placed word to return it. Check
 * grades the joined sequence against the correct sentence.
 */
export function OrderExercise({ item, onComplete }: OrderExerciseProps) {
  const tokens = useMemo<Tile[]>(() => {
    const words = (item.words && item.words.length > 0 ? item.words : item.correctSentence.split(/\s+/)).filter(Boolean);
    return words.map((word, key) => ({ key, word }));
  }, [item]);

  const [bank, setBank] = useState<Tile[]>(() => scramble(tokens));
  const [placed, setPlaced] = useState<Tile[]>([]);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [attempts, setAttempts] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const place = (tile: Tile) => {
    if (result) return;
    setBank(b => b.filter(t => t.key !== tile.key));
    setPlaced(p => [...p, tile]);
  };
  const unplace = (tile: Tile) => {
    if (result) return;
    setPlaced(p => p.filter(t => t.key !== tile.key));
    setBank(b => [...b, tile]);
  };

  const handleCheck = () => {
    if (bank.length > 0 || result) return;
    const built = placed.map(t => t.word).join(' ');
    const target = tokens.map(t => t.word).join(' ');
    setAttempts(a => a + 1);
    if (built === target) {
      setResult('correct');
      timerRef.current = setTimeout(() => onComplete({ correct: attempts === 0, attempts: attempts + 1 }), 1800);
    } else {
      setResult('wrong');
    }
  };

  const handleTryAgain = () => {
    setResult(null);
    setPlaced([]);
    setBank(scramble(tokens));
  };

  return (
    <div>
      <p className="px-4 pb-2 text-sm text-slate-600">Tap the words in order to build the sentence.</p>

      {/* Answer row */}
      <div className={`mx-4 mb-3 min-h-[56px] p-2 rounded-xl border-2 border-dashed flex flex-wrap gap-1.5 items-center ${
        result === 'correct' ? 'border-emerald-300 bg-emerald-50'
        : result === 'wrong' ? 'border-red-300 bg-red-50'
        : 'border-slate-300 bg-slate-50'
      }`}>
        {placed.length === 0 && <span className="text-xs text-slate-400 px-1">Your sentence appears here…</span>}
        {placed.map(tile => (
          <button
            key={tile.key}
            onClick={() => unplace(tile)}
            disabled={!!result}
            className="px-2.5 py-1.5 rounded-full bg-indigo-600 text-white text-sm font-medium active:bg-indigo-700"
          >
            {tile.word}
          </button>
        ))}
      </div>

      {/* Tile bank */}
      <div className="px-4 pb-3 flex flex-wrap gap-2">
        {bank.map(tile => (
          <button
            key={tile.key}
            onClick={() => place(tile)}
            disabled={!!result}
            className="px-3 py-2 rounded-full bg-white border border-slate-300 text-slate-700 text-sm active:scale-95 transition-transform"
          >
            {tile.word}
          </button>
        ))}
      </div>

      {!result && (
        <div className="px-4 pb-3">
          <button
            onClick={handleCheck}
            disabled={bank.length > 0}
            className={`w-full py-2.5 rounded-xl font-semibold text-white ${bank.length === 0 ? 'bg-indigo-600 active:bg-indigo-700' : 'bg-slate-300'}`}
          >
            {bank.length === 0 ? 'Check' : `Place all words (${placed.length}/${tokens.length})`}
          </button>
        </div>
      )}

      {result === 'correct' && (
        <FeedbackPanel correct explanation={item.explanation} explanationArabic={item.explanationArabic} />
      )}
      {result === 'wrong' && (
        <>
          <FeedbackPanel
            correct={false}
            extra={<p>Correct sentence: <span className="font-semibold">{item.correctSentence}</span></p>}
            explanation={item.explanation}
            explanationArabic={item.explanationArabic}
          />
          <div className="px-4 pb-3 flex gap-2">
            <button onClick={handleTryAgain} className="flex-1 py-2.5 rounded-xl font-semibold bg-slate-100 text-slate-700 active:bg-slate-200">
              Try again
            </button>
            <button onClick={() => onComplete({ correct: false, attempts })} className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-indigo-600 active:bg-indigo-700">
              Continue →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
