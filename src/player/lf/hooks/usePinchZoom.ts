import React, { useEffect, useRef, useState } from 'react';

export const ZOOM_MIN = 0.85;
export const ZOOM_MAX = 2.0;
export const ZOOM_STEP = 0.125;
export const ZOOM_DEFAULT = 1.0;
export const ZOOM_STORAGE_KEY = 'hintFontSize';

export function loadZoom(): number {
  try {
    const n = parseFloat(localStorage.getItem(ZOOM_STORAGE_KEY) || '');
    if (isFinite(n) && n >= ZOOM_MIN && n <= ZOOM_MAX) return n;
  } catch { /* storage unavailable */ }
  return ZOOM_DEFAULT;
}

export function saveZoom(size: number): void {
  try { localStorage.setItem(ZOOM_STORAGE_KEY, String(size)); } catch { /* ignore */ }
}

export const clampZoom = (n: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +n.toFixed(3)));

/**
 * Two-finger pinch that drives a FONT SIZE (rem), not a CSS transform — so
 * text reflows instead of needing horizontal panning, and never blurs.
 * Coexists with one-finger scroll and the parent's swipe handlers because it
 * only acts when exactly two fingers are down.
 * (Ported from vocalize-mvp hooks/usePinchZoom.ts.)
 */
export function usePinchZoom(
  targetRef: React.RefObject<HTMLElement | null>,
  currentSize: number,
  setSize: React.Dispatch<React.SetStateAction<number>>,
) {
  const initialDistance = useRef(-1);
  const initialSize = useRef(currentSize);

  // Read the live size from a ref so listeners never need rebinding per tick
  const sizeRef = useRef(currentSize);
  sizeRef.current = currentSize;

  // Track the real DOM node so the effect rebinds when the target remounts
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const node = targetRef.current ?? null;
    if (node !== el) setEl(node);
  });

  useEffect(() => {
    if (!el) return;

    const getDistance = (touches: TouchList) =>
      Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
      );

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance.current = getDistance(e.touches);
        initialSize.current = sizeRef.current;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance.current > 0) {
        e.preventDefault(); // suppress native pinch-zoom of the whole page
        const scale = getDistance(e.touches) / initialDistance.current;
        setSize(clampZoom(initialSize.current * scale));
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) initialDistance.current = -1;
    };

    // iOS Safari fires proprietary gesture events alongside touch events
    const onGesture = (e: Event) => e.preventDefault();

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('gesturestart', onGesture, { passive: false } as any);
    el.addEventListener('gesturechange', onGesture, { passive: false } as any);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('gesturestart', onGesture);
      el.removeEventListener('gesturechange', onGesture);
    };
  }, [el, setSize]);
}
