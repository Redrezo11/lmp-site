import { useState, useMemo } from 'react';
import { MatchItem } from '../../types/practice';
import { FeedbackPanel } from './FeedbackPanel';
import { useAssist } from '../../hooks/useAssist';
import { AssistToggle } from './AssistToggle';
import { BilingualText } from './Bilingual';

interface Card {
  id: string;
  content: string;
  pairId: number;
  side: 'left' | 'right';
}

interface MatchExerciseProps {
  item: MatchItem;
  onComplete: (result: { correct: boolean; attempts: number }) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Tap-to-select-pair matching (ported from vocalize LexisMatchGame — tap two
 * cards to match; wrong pair shakes and locks input briefly). More reliable
 * than drag on phones.
 */
export function MatchExercise({ item, onComplete }: MatchExerciseProps) {
  const assist = useAssist();
  const cards = useMemo<Card[]>(() => shuffle(
    item.pairs.flatMap((p, i) => [
      { id: `${i}-l`, content: p.left, pairId: i, side: 'left' as const },
      { id: `${i}-r`, content: p.right, pairId: i, side: 'right' as const },
    ])
  ), [item]);

  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [incorrectPair, setIncorrectPair] = useState<[string, string] | null>(null);
  const [wrongTaps, setWrongTaps] = useState(0);
  const [finished, setFinished] = useState(false);

  const handleTap = (card: Card) => {
    if (finished || incorrectPair) return;
    if (matched.has(card.pairId) && !selected) return;
    if (matched.has(card.pairId)) return;
    if (selected === card.id) { setSelected(null); return; }

    if (!selected) { setSelected(card.id); return; }

    const first = cards.find(c => c.id === selected)!;
    if (first.pairId === card.pairId && first.side !== card.side) {
      const next = new Set([...matched, card.pairId]);
      setMatched(next);
      setSelected(null);
      if (next.size === item.pairs.length) {
        setTimeout(() => setFinished(true), 600);
      }
    } else {
      setWrongTaps(w => w + 1);
      setIncorrectPair([selected, card.id]);
      setTimeout(() => { setIncorrectPair(null); setSelected(null); }, 800);
    }
  };

  const cardState = (card: Card): 'default' | 'selected' | 'matched' | 'incorrect' => {
    if (matched.has(card.pairId)) return 'matched';
    if (incorrectPair?.includes(card.id)) return 'incorrect';
    if (selected === card.id) return 'selected';
    return 'default';
  };

  const stateClasses: Record<string, string> = {
    default: 'bg-white border-slate-200 text-slate-700 active:scale-95',
    selected: 'bg-indigo-50 border-indigo-400 text-indigo-800 scale-105 shadow-lg shadow-indigo-500/20',
    matched: 'bg-emerald-50 border-emerald-300 text-emerald-700 scale-95 opacity-70',
    incorrect: 'bg-red-50 border-red-300 text-red-700 animate-shake',
  };

  return (
    <div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-5px)}40%,80%{transform:translateX(5px)}}.animate-shake{animation:shake 0.4s ease-in-out}`}</style>
      <div className="px-4 pb-2">
        <BilingualText
          size="instructions"
          arabic={assist ? item.instructionsArabic : null}
          english={item.instructions || 'Tap two cards to match each pair.'}
        />
        {item.instructionsArabic?.trim() && <AssistToggle className="mt-2" />}
      </div>
      <div className="px-4 pb-3 grid grid-cols-2 gap-2">
        {cards.map(card => (
          <button
            key={card.id}
            onClick={() => handleTap(card)}
            disabled={matched.has(card.pairId) || finished}
            className={`relative min-h-[64px] px-2 py-2 rounded-xl border-2 text-sm leading-snug transition-all duration-200 ${stateClasses[cardState(card)]}`}
          >
            {card.content}
            {matched.has(card.pairId) && <span className="absolute top-1 right-1.5 text-emerald-500 text-xs">✓</span>}
          </button>
        ))}
      </div>
      <div className="px-4 pb-2">
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${(matched.size / item.pairs.length) * 100}%` }} />
        </div>
      </div>
      {finished && (
        <FeedbackPanel
          correct={wrongTaps === 0}
          extra={wrongTaps > 0 ? <p>Completed with {wrongTaps} wrong tap{wrongTaps !== 1 ? 's' : ''}.</p> : undefined}
          explanation={item.explanation}
          explanationArabic={item.explanationArabic}
          onContinue={() => onComplete({ correct: wrongTaps === 0, attempts: wrongTaps })}
        />
      )}
    </div>
  );
}
