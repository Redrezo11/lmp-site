/**
 * Single requestAnimationFrame loop managing all timed actions
 * (reveals + annotations) for one slide. Polls audio.currentTime
 * once per frame instead of N independent rAF loops.
 */

export interface TimedAction {
  id: string;
  showAt: number;
  hideAt?: number;
  onShow: () => void;
  onHide: () => void;
  isActive: boolean;
}

export class SlideTimingCoordinator {
  private actions: TimedAction[] = [];
  private audioRef: React.RefObject<HTMLAudioElement | null>;
  private rafId: number | null = null;
  private isRunning = false;

  constructor(audioRef: React.RefObject<HTMLAudioElement | null>) {
    this.audioRef = audioRef;
  }

  register(action: TimedAction): void {
    this.actions.push(action);
    this.actions.sort((a, b) => a.showAt - b.showAt);
  }

  unregister(id: string): void {
    const idx = this.actions.findIndex(a => a.id === id);
    if (idx !== -1) {
      if (this.actions[idx].isActive) {
        this.actions[idx].onHide();
      }
      this.actions.splice(idx, 1);
    }
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.tick();
  }

  stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick = (): void => {
    if (!this.isRunning) return;

    const audio = this.audioRef.current;
    if (!audio) { this.rafId = requestAnimationFrame(this.tick); return; }

    const currentTime = audio.currentTime;

    for (const action of this.actions) {
      const shouldBeActive = currentTime >= action.showAt
        && (action.hideAt === undefined || currentTime < action.hideAt);

      if (shouldBeActive && !action.isActive) {
        action.onShow();
        action.isActive = true;
      } else if (!shouldBeActive && action.isActive) {
        action.onHide();
        action.isActive = false;
      }
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  resetToTime(time: number): void {
    for (const action of this.actions) {
      if (action.isActive && (time < action.showAt || (action.hideAt !== undefined && time >= action.hideAt))) {
        action.onHide();
        action.isActive = false;
      }
    }
  }

  destroy(): void {
    this.stop();
    for (const action of this.actions) {
      if (action.isActive) {
        action.onHide();
        action.isActive = false;
      }
    }
    this.actions = [];
  }
}
