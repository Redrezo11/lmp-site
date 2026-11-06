import React, { useRef, useEffect, ReactNode } from 'react';

interface RevealOnTimeProps {
  time: number;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  children: ReactNode;
  duration?: number;
}

/**
 * Wraps children in a visibility container that reveals at a specific
 * time in the audio playback. Uses refs + classList for performance —
 * NEVER stores currentTime in React state (timeupdate fires 4-66x/sec).
 */
export function RevealOnTime({ time, audioRef, children, duration = 300 }: RevealOnTimeProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const revealed = useRef(false);

  useEffect(() => {
    // Poll for audioRef.current since it may not exist yet (audio not started)
    // Elements stay hidden until audio plays and reaches their timestamp
    let animFrame: number;
    let cleanupListeners: (() => void) | null = null;
    // LMP site: also checked every frame (format sheet §7.3: a requestAnimationFrame
    // loop). 'timeupdate' alone fires ~4×/s, which showed text up to 0.25 s late.
    let check: (() => void) | null = null;

    const attachToAudio = (audio: HTMLAudioElement) => {
      const onTime = () => {
        const now = audio.currentTime;
        if (now >= time && !revealed.current) {
          revealed.current = true;
          elRef.current?.classList.add('revealed');
        } else if (now < time && revealed.current) {
          revealed.current = false;
          elRef.current?.classList.remove('revealed');
        }
      };

      audio.addEventListener('timeupdate', onTime);
      audio.addEventListener('seeked', onTime);
      onTime(); // Check immediately
      check = onTime;

      cleanupListeners = () => {
        audio.removeEventListener('timeupdate', onTime);
        audio.removeEventListener('seeked', onTime);
        check = null;
      };
    };

    // Check periodically if audioRef has been populated
    const poll = () => {
      const audio = audioRef.current;
      if (audio && !cleanupListeners) {
        attachToAudio(audio);
      } else if (audio && check) {
        check();
      } else if (!audio && cleanupListeners) {
        // Audio was removed (stopped) — hide element again
        cleanupListeners();
        cleanupListeners = null;
        if (revealed.current) {
          revealed.current = false;
          elRef.current?.classList.remove('revealed');
        }
      }
      animFrame = requestAnimationFrame(poll);
    };

    // Start polling (lightweight — just checks a ref)
    animFrame = requestAnimationFrame(poll);

    return () => {
      cancelAnimationFrame(animFrame);
      cleanupListeners?.();
    };
  }, [time, audioRef]);

  return (
    <div
      ref={elRef}
      className="reveal-wrapper"
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * Wrap that shows children immediately (no reveal timing).
 * Used for elements with revealGroup 0 (always visible).
 */
export function AlwaysVisible({ children }: { children: ReactNode }) {
  return <div className="reveal-wrapper revealed">{children}</div>;
}
