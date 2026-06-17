import { createServer, type Server as HttpServer } from 'node:http';
import { Router } from 'express';
import { asUserId, money } from '@gamesphere/shared';
import type { AppConfig } from '@/config/env.js';
import { MetricsRegistry } from '@/infrastructure/metrics/metrics-registry.js';
import { createLogger, type Logger } from '@/shared/logger.js';
import { SystemClock } from '@/shared/clock.js';
import { NanoidGenerator } from '@/shared/id-generator.js';
import { connectMongo, disconnectMongo } from '@/infrastructure/mongo/mongo-connection.js';
import { createRedis } from '@/infrastructure/redis/redis-client.js';
import { createHttpApp } from '@/infrastructure/http/create-app.js';
import { createSocketServer, type AppSocketServer } from '@/infrastructure/ws/socket-server.js';
import { createAuthGuard } from '@/infrastructure/http/middleware/auth-guard.js';
import { JwtTokenService } from '@/modules/auth/infrastructure/jwt-token-service.js';
import { MongoUserRepository } from '@/modules/auth/infrastructure/mongo-user-repository.js';
import { LoginOrRegisterUser } from '@/modules/auth/application/login-or-register.js';
import { GetProfile } from '@/modules/auth/application/get-profile.js';
import { composeUserLifecycleListeners } from '@/modules/auth/domain/user-lifecycle.js';
import { AuthController } from '@/modules/auth/interface/auth.controller.js';
import { UserController } from '@/modules/auth/interface/user.controller.js';
import { createAuthRoutes } from '@/modules/auth/interface/routes.js';
import { MongoWalletRepository } from '@/modules/wallet/infrastructure/mongo-wallet-repository.js';
import { CreditFunds } from '@/modules/wallet/application/credit-funds.js';
import { GetWallet } from '@/modules/wallet/application/get-wallet.js';
import { GetLedgerJournal } from '@/modules/wallet/application/get-ledger-journal.js';
import { GetLedgerIntegrity } from '@/modules/wallet/application/get-ledger-integrity.js';
import { HoldEntryFee } from '@/modules/wallet/application/hold-entry-fee.js';
import { RefundEntryFee } from '@/modules/wallet/application/refund-entry-fee.js';
import { SignupBonusGranter } from '@/modules/wallet/application/signup-bonus-granter.js';
import { WalletController } from '@/modules/wallet/interface/wallet.controller.js';
import { createWalletRoutes } from '@/modules/wallet/interface/routes.js';
import { userAccount } from '@/modules/wallet/domain/account.js';
import { RedisEventBus } from '@/modules/events/infrastructure/redis-event-bus.js';
import { RedisMatchmakingQueue } from '@/modules/matchmaking/infrastructure/redis-matchmaking-queue.js';
import { MongoMatchRepository } from '@/modules/matchmaking/infrastructure/mongo-match-repository.js';
import { JoinQueue } from '@/modules/matchmaking/application/join-queue.js';
import { LeaveQueue } from '@/modules/matchmaking/application/leave-queue.js';
import { GetMatchmakingStatus } from '@/modules/matchmaking/application/get-status.js';
import { FormMatch } from '@/modules/matchmaking/application/form-match.js';
import { MatchmakingWorker } from '@/modules/matchmaking/application/matchmaking-worker.js';
import { ENTRY_FEE_TIERS } from '@/modules/matchmaking/domain/tiers.js';
import { MatchmakingController } from '@/modules/matchmaking/interface/matchmaking.controller.js';
import { createMatchmakingRoutes } from '@/modules/matchmaking/interface/routes.js';
import { MatchStatus } from '@/modules/matchmaking/domain/match.js';
import { SettleMatch } from '@/modules/wallet/application/settle-match.js';
import { GameService } from '@/modules/game/application/game-service.js';
import { SocketGameGateway } from '@/modules/game/infrastructure/socket-game-gateway.js';
import { ProvablyFairDiceRoller } from '@/modules/game/infrastructure/provably-fair-dice.js';
import { RealTimerScheduler } from '@/modules/game/domain/timer-scheduler.js';
import { registerGameHandlers } from '@/modules/game/interface/socket-handler.js';
import { RedisLeaderboardStore } from '@/modules/leaderboard/infrastructure/redis-leaderboard-store.js';
import { UpdateRatingsOnGameEnded } from '@/modules/leaderboard/application/update-ratings-on-game-ended.js';
import { LeaderboardSeeder } from '@/modules/leaderboard/application/leaderboard-seeder.js';
import { GetLeaderboard } from '@/modules/leaderboard/application/get-leaderboard.js';
import { LeaderboardController } from '@/modules/leaderboard/interface/leaderboard.controller.js';
import { createLeaderboardRoutes } from '@/modules/leaderboard/interface/routes.js';
import { SocketNotifier } from '@/modules/notification/infrastructure/socket-notifier.js';
import { MongoPlayerEventRepository } from '@/modules/anticheat/infrastructure/mongo-player-event-repository.js';
import { AntiCheatMonitor } from '@/modules/anticheat/application/anti-cheat-monitor.js';
import { DomainEventType, type GameEndedEvent } from '@gamesphere/shared';
import { GetOverview } from '@/modules/ops/application/get-overview.js';
import { GetMetrics } from '@/modules/ops/application/get-metrics.js';
import { OpsEventForwarder } from '@/modules/ops/application/ops-event-forwarder.js';
import { DependencyHealthChecker } from '@/modules/ops/infrastructure/health-checker.js';
import { SocketOpsBroadcaster } from '@/modules/ops/infrastructure/socket-ops-broadcaster.js';
import { OpsController } from '@/modules/ops/interface/ops.controller.js';
import { createOpsRoutes } from '@/modules/ops/interface/routes.js';

export interface AppContext {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly httpServer: HttpServer;
  readonly io: AppSocketServer;
  shutdown(): Promise<void>;
}

/**
 * The composition root: the single place that instantiates concrete adapters
 * and injects them into use cases and controllers. Everything downstream
 * depends on interfaces, so swapping an implementation (e.g. an in-memory
 * repository for tests) is a one-line change here and nowhere else.
 */
export const buildApp = async (config: AppConfig): Promise<AppContext> => {
  const logger = createLogger(config.LOG_LEVEL, !config.isProduction);

  // --- Infrastructure connections ---
  await connectMongo(config.MONGO_URI, logger);
  const redis = createRedis(config.REDIS_URL, logger);

  // --- Shared adapters (ports -> concretions) ---
  const clock = new SystemClock();
  const ids = new NanoidGenerator();
  const metrics = new MetricsRegistry(clock);
  const tokens = new JwtTokenService({
    secret: config.JWT_SECRET,
    expiresIn: config.JWT_EXPIRES_IN,
  });

  // --- Event bus (Redis Pub/Sub; dedicated subscriber connection) ---
  const redisSub = redis.duplicate();
  const eventBus = new RedisEventBus(redis, redisSub, logger);

  // --- Wallet module (double-entry ledger) ---
  const walletRepo = new MongoWalletRepository(ids, clock);
  const creditFunds = new CreditFunds(walletRepo, ids);
  const getWallet = new GetWallet(walletRepo);
  const holdEntryFee = new HoldEntryFee(walletRepo, ids);
  const refundEntryFee = new RefundEntryFee(walletRepo, ids);
  const settleMatch = new SettleMatch(walletRepo, ids, config.DEFAULT_RAKE_BPS);
  const getLedgerJournal = new GetLedgerJournal(walletRepo);
  const getLedgerIntegrity = new GetLedgerIntegrity(walletRepo);
  const signupBonus = new SignupBonusGranter(
    creditFunds,
    money(config.SIGNUP_BONUS_MINOR),
    logger,
  );
  const walletController = new WalletController(
    getWallet,
    creditFunds,
    getLedgerJournal,
    ids,
  );

  // --- Auth / identity module ---
  const userRepo = new MongoUserRepository();
  const playerProfiles = {
    rating: async (userId: string) =>
      (await userRepo.findById(asUserId(userId)))?.rating ?? null,
    setRating: (userId: string, rating: number) =>
      userRepo.updateRating(asUserId(userId), rating),
    profile: async (userId: string) => {
      const u = await userRepo.findById(asUserId(userId));
      return u ? { username: u.username, rating: u.rating } : null;
    },
  };

  // --- Leaderboard module (Redis sorted sets) ---
  const leaderboardStore = new RedisLeaderboardStore(redis, clock);
  const updateRatings = new UpdateRatingsOnGameEnded(
    playerProfiles,
    leaderboardStore,
    eventBus,
    clock,
  );
  eventBus.subscribe(DomainEventType.GameEnded, (e) =>
    updateRatings.handle(e as GameEndedEvent),
  );
  const leaderboardSeeder = new LeaderboardSeeder(leaderboardStore);
  const leaderboardController = new LeaderboardController(
    new GetLeaderboard(leaderboardStore, playerProfiles),
  );

  // --- Anti-cheat module (player event log + streak detection) ---
  const antiCheat = new AntiCheatMonitor(
    new MongoPlayerEventRepository(),
    ids,
    clock,
    logger,
  );
  antiCheat.register(eventBus);

  const loginOrRegister = new LoginOrRegisterUser(
    userRepo,
    tokens,
    ids,
    clock,
    // grant the signup bonus AND seed the leaderboard on registration
    composeUserLifecycleListeners(signupBonus, leaderboardSeeder),
  );
  const getProfile = new GetProfile(userRepo);
  const authController = new AuthController(loginOrRegister);
  const userController = new UserController(getProfile);
  const authGuard = createAuthGuard(tokens);

  // --- Matchmaking module ---
  const matchmakingQueue = new RedisMatchmakingQueue(redis);
  const matchRepo = new MongoMatchRepository();
  // Inline adapters bridge matchmaking's narrow ports to the wallet/auth modules.
  const joinQueue = new JoinQueue(
    matchmakingQueue,
    { available: (userId) => walletRepo.getBalance(userAccount(userId)) },
    { ratingOf: async (userId) => (await userRepo.findById(asUserId(userId)))?.rating ?? null },
    eventBus,
    clock,
  );
  const leaveQueue = new LeaveQueue(matchmakingQueue);
  const getStatus = new GetMatchmakingStatus(matchRepo, matchmakingQueue);
  const formMatch = new FormMatch(
    matchmakingQueue,
    {
      hold: (userId, matchId, amount) =>
        holdEntryFee.execute({ userId, matchId, amount }),
      refund: (userId, matchId, amount) =>
        refundEntryFee.execute({ userId, matchId, amount }),
    },
    matchRepo,
    eventBus,
    ids,
    clock,
  );
  const matchmakingController = new MatchmakingController(joinQueue, leaveQueue, getStatus);
  const matchmakingWorker = new MatchmakingWorker(
    matchmakingQueue,
    formMatch,
    ENTRY_FEE_TIERS.map(Number),
    1000,
    logger,
  );

  // --- HTTP + WebSocket transport ---
  // The ops router is populated after Socket.IO is created (it needs the io
  // connection count), but is mounted now so its routes resolve at request time.
  const opsRouter = Router();
  const app = createHttpApp({
    config,
    logger,
    metrics,
    opsRouter,
    mountApi: (router) => {
      router.use(createAuthRoutes(authController, userController, authGuard));
      router.use(createWalletRoutes(walletController, authGuard));
      router.use(createMatchmakingRoutes(matchmakingController, authGuard));
      router.use(createLeaderboardRoutes(leaderboardController));
    },
  });
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer, { config, logger, tokens });
  const realtime = new SocketGameGateway(io);

  // Push notifications: turn domain events into realtime client messages.
  new SocketNotifier(eventBus, realtime).register();

  // --- Ops / observability module ---
  const health = new DependencyHealthChecker(redis);
  const wsStats = { connectionCount: () => io.engine.clientsCount };
  const opsController = new OpsController(
    new GetOverview(
      {
        activePlayers: () => redis.scard('mm:active'),
        queueLength: async () => {
          const sizes = await Promise.all(
            ENTRY_FEE_TIERS.map((fee) => matchmakingQueue.size(Number(fee))),
          );
          return sizes.reduce((a, b) => a + b, 0);
        },
      },
      { activeMatches: () => matchRepo.countActive() },
      wsStats,
      health,
    ),
    new GetMetrics(metrics, wsStats, health),
    getLedgerIntegrity,
  );
  opsRouter.use(createOpsRoutes(opsController));
  new OpsEventForwarder(eventBus, new SocketOpsBroadcaster(io)).register();

  // --- Game module (authoritative realtime loop) ---
  const gameService = new GameService(
    {
      load: async (matchId) => {
        const m = await matchRepo.findById(matchId);
        return m
          ? { id: m.id, entryFee: m.entryFee, pool: m.pool, players: m.players, status: m.status }
          : null;
      },
      markActive: (matchId) => matchRepo.setStatus(matchId, MatchStatus.Active),
      markResult: (matchId, winnerId) =>
        matchRepo.setResult(matchId, winnerId, MatchStatus.Settled),
    },
    {
      settle: (matchId, winnerId, pool) =>
        settleMatch.execute({ matchId, winnerId, pool }),
    },
    matchmakingQueue, // ActivePlayersReleaser (release)
    eventBus,
    realtime,
    new RealTimerScheduler(),
    () => new ProvablyFairDiceRoller(),
    {
      usernameOf: async (userId) =>
        (await userRepo.findById(asUserId(userId)))?.username ?? null,
    },
    clock,
    logger,
    {
      turnTimeoutMs: config.TURN_TIMEOUT_MS,
      disconnectGraceMs: config.DISCONNECT_GRACE_MS,
      maxMissedTurns: 2,
    },
  );
  io.on('connection', registerGameHandlers(gameService));

  matchmakingWorker.start();

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down...');
    matchmakingWorker.stop();
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    redisSub.disconnect();
    redis.disconnect();
    await disconnectMongo();
  };

  return { config, logger, httpServer, io, shutdown };
};
