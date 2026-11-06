import { useRef, useState, useEffect, ReactNode } from 'react';

interface SlideCanvasProps {
  children: ReactNode;
  className?: string;
}

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

export function SlideCanvas({ children, className = '' }: SlideCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect;
      if (width > 0) setScale(width / SLIDE_W);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden ${className}`}
      style={{ paddingBottom: `${(SLIDE_H / SLIDE_W) * 100}%` }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: SLIDE_W,
          height: SLIDE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}
