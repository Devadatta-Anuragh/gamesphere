export type TimerHandle = unknown;

/**
 * Abstraction over setTimeout so the game service's turn/disconnect timers are
 * injectable. Tests use a no-op (or manually-fired) scheduler to keep game
 * logic fully deterministic; production uses the real timer.
 */
export interface TimerScheduler {
  schedule(fn: () => void, ms: number): TimerHandle;
  cancel(handle: TimerHandle): void;
}

export class RealTimerScheduler implements TimerScheduler {
  schedule(fn: () => void, ms: number): TimerHandle {
    return setTimeout(fn, ms);
  }
  cancel(handle: TimerHandle): void {
    if (handle) clearTimeout(handle as NodeJS.Timeout);
  }
}
