import type { GameGateway } from '@/modules/game/domain/game-gateway.js';
import type {
  TimerHandle,
  TimerScheduler,
} from '@/modules/game/domain/timer-scheduler.js';
import type { LegalMove } from '@/modules/game/domain/ludo/engine.js';
import type { GameStateView } from '@/modules/game/interface/state-view.js';

/** Records everything the service tries to push to clients, for assertions. */
export class FakeGameGateway implements GameGateway {
  latestState: GameStateView | null = null;
  ended: { winnerId: string | null; winnings: number; rake: number; dice: { serverSeed: string } } | null =
    null;
  readonly legalByUser = new Map<string, LegalMove[]>();
  readonly roomEvents: { event: string }[] = [];

  toRoom(_matchId: string, event: string, data: unknown): void {
    this.roomEvents.push({ event });
    if (event === 'game:state') this.latestState = data as GameStateView;
    if (event === 'game:ended') this.ended = data as typeof this.ended;
  }

  toUser(userId: string, event: string, data: unknown): void {
    if (event === 'game:legalMoves') {
      this.legalByUser.set(userId, (data as { moves: LegalMove[] }).moves);
    }
  }
}

/** Scheduler whose timers only fire when the test explicitly triggers them. */
export class ManualScheduler implements TimerScheduler {
  private readonly pending = new Map<number, () => void>();
  private seq = 0;

  schedule(fn: () => void): TimerHandle {
    const id = ++this.seq;
    this.pending.set(id, fn);
    return id;
  }
  cancel(handle: TimerHandle): void {
    if (typeof handle === 'number') this.pending.delete(handle);
  }
  /** Fire the most recently scheduled (still-pending) timer. */
  fireLatest(): void {
    const ids = [...this.pending.keys()];
    const last = ids[ids.length - 1];
    if (last === undefined) return;
    const fn = this.pending.get(last)!;
    this.pending.delete(last);
    fn();
  }
}

export const pickGreedy = (moves: readonly LegalMove[]): LegalMove =>
  [...moves].sort((a, b) => {
    if (a.finishes !== b.finishes) return a.finishes ? -1 : 1;
    if (a.captures.length !== b.captures.length)
      return b.captures.length - a.captures.length;
    return b.to - a.to;
  })[0]!;

export const flush = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));
