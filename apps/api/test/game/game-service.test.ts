import { beforeEach, describe, expect, it } from 'vitest';
import { money } from '@gamesphere/shared';
import { GameService } from '@/modules/game/application/game-service.js';
import type { MatchGateway, MatchInfo } from '@/modules/game/application/ports.js';
import { ProvablyFairDiceRoller } from '@/modules/game/infrastructure/provably-fair-dice.js';
import { userAccount } from '@/modules/wallet/domain/account.js';
import { EntryReason } from '@/modules/wallet/domain/ledger.js';
import { CreditFunds } from '@/modules/wallet/application/credit-funds.js';
import { HoldEntryFee } from '@/modules/wallet/application/hold-entry-fee.js';
import { SettleMatch } from '@/modules/wallet/application/settle-match.js';
import { FixedClock } from '@/shared/clock.js';
import { SequentialIdGenerator } from '@/shared/id-generator.js';
import { createLogger } from '@/shared/logger.js';
import { InMemoryWalletRepository } from '../helpers/in-memory-wallet-repository.js';
import { FakeGameGateway, ManualScheduler, flush, pickGreedy } from '../helpers/game.js';

const MATCH_ID = 'match-1';
const ENTRY_FEE = 10_000;
const silentLogger = createLogger('fatal', false);

const buildMatchGateway = (
  status: { value: MatchInfo['status'] },
  result: { winnerId: string | null },
): MatchGateway => ({
  load: async () => ({
    id: MATCH_ID,
    entryFee: money(ENTRY_FEE),
    pool: money(ENTRY_FEE * 2),
    players: [
      { userId: 'p0', seat: 0 },
      { userId: 'p1', seat: 1 },
    ],
    status: status.value,
  }),
  markActive: async () => {
    status.value = 'ACTIVE';
  },
  markResult: async (_id, winnerId) => {
    result.winnerId = winnerId;
    status.value = 'SETTLED';
  },
});

describe('GameService — full match + settlement', () => {
  let wallet: InMemoryWalletRepository;
  let gateway: FakeGameGateway;
  let scheduler: ManualScheduler;
  let released: string[];
  let status: { value: MatchInfo['status'] };
  let result: { winnerId: string | null };
  let service: GameService;

  beforeEach(async () => {
    const ids = new SequentialIdGenerator('w');
    const clock = new FixedClock(1_000);
    wallet = new InMemoryWalletRepository(ids, clock);
    gateway = new FakeGameGateway();
    scheduler = new ManualScheduler();
    released = [];
    status = { value: 'PENDING' };
    result = { winnerId: null };

    // Fund both players and escrow their stakes (as matchmaking would have).
    const credit = new CreditFunds(wallet, ids);
    const hold = new HoldEntryFee(wallet, ids);
    for (const u of ['p0', 'p1']) {
      await credit.execute({
        userId: u,
        amount: money(50_000),
        reason: EntryReason.Deposit,
        idempotencyKey: `seed:${u}`,
      });
      await hold.execute({ userId: u, matchId: MATCH_ID, amount: money(ENTRY_FEE) });
    }

    service = new GameService(
      buildMatchGateway(status, result),
      { settle: (m, w, pool) => new SettleMatch(wallet, ids, 1000).execute({ matchId: m, winnerId: w, pool }) },
      { release: async (ids2) => void released.push(...ids2) },
      { publish: async () => {} },
      gateway,
      scheduler,
      () => new ProvablyFairDiceRoller('game-seed'.padEnd(64, '0')),
      { usernameOf: async (id: string) => `name-${id}` },
      clock,
      silentLogger,
      { turnTimeoutMs: 10_000, disconnectGraceMs: 10_000, maxMissedTurns: 2 },
    );
  });

  it('plays a full authoritative game and settles the winner idempotently', async () => {
    expect((await service.handleJoin('p0', MATCH_ID)).ok).toBe(true);
    expect((await service.handleJoin('p1', MATCH_ID)).ok).toBe(true);
    expect(status.value).toBe('ACTIVE');

    const seatUser = (seat: number) => (seat === 0 ? 'p0' : 'p1');
    let guard = 0;
    while (!gateway.ended && guard++ < 20_000) {
      const view = gateway.latestState!;
      const user = seatUser(view.turnSeat);
      if (view.phase === 'AWAITING_ROLL') {
        service.handleRoll(user, MATCH_ID);
      } else if (view.phase === 'AWAITING_MOVE') {
        const moves = gateway.legalByUser.get(user) ?? [];
        service.handleMove(user, MATCH_ID, pickGreedy(moves).tokenIndex);
      }
      await flush(); // let any finishGame() settlement resolve
    }

    expect(gateway.ended).not.toBeNull();
    const winner = gateway.ended!.winnerId!;
    const loser = winner === 'p0' ? 'p1' : 'p0';

    // Winner paid pool - 10% rake; loser keeps only their non-staked balance.
    expect(gateway.ended!.winnings).toBe(18_000);
    expect(gateway.ended!.rake).toBe(2_000);
    expect(await wallet.getBalance(userAccount(winner))).toBe(58_000); // 40k + 18k
    expect(await wallet.getBalance(userAccount(loser))).toBe(40_000);

    // Lifecycle side-effects.
    expect(status.value).toBe('SETTLED');
    expect(result.winnerId).toBe(winner);
    expect(released.sort()).toEqual(['p0', 'p1']);
    // Provably-fair seed revealed at the end.
    expect(gateway.ended!.dice.serverSeed.length).toBeGreaterThan(0);
  });

  it('forfeits to the opponent when a disconnected player exceeds the grace period', async () => {
    await service.handleJoin('p0', MATCH_ID);
    await service.handleJoin('p1', MATCH_ID);

    service.handleDisconnect('p1'); // schedules grace timer
    scheduler.fireLatest(); // grace expires
    await flush();

    expect(gateway.ended).not.toBeNull();
    expect(gateway.ended!.winnerId).toBe('p0');
    expect(await wallet.getBalance(userAccount('p0'))).toBe(58_000);
    expect(status.value).toBe('SETTLED');
  });
});
