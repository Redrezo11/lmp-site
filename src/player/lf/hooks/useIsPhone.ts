import { useState, useEffect } from 'react';

/**
 * True only for PHONES — a coarse pointer AND a short screen edge under 600px.
 * Using the screen's short edge (not the viewport width) keeps the answer
 * stable in landscape and correctly classifies tablets/iPads as NOT phones,
 * so desktop and tablet users keep the real slide presentation.
 */
function detectPhone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const shortEdge = Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight);
    return coarse && shortEdge < 600;
  } catch {
    return false;
  }
}

export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(detectPhone);

  useEffect(() => {
    const update = () => setIsPhone(detectPhone());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return isPhone;
}
