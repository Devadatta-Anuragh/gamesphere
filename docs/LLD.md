# GameSphere — Low-Level Design (LLD)

How the code is organized, the key types per module, the data models, the Redis
keyspace, the event contracts, and the important sequence flows.

---

## 1. Layering & conventions

Every module follows **ports & adapters (hexagonal)**:

```
modules/<name>/
  domain/          entities, value objects, PORT interfaces (no I/O, no framework)
  application/     use cases — orchestrate domain + ports, return Result<T, AppError>
  infrastructure/  ADAPTERS — Mongoose repos, Redis adapters, crypto, sockets
  interface/       thin HTTP controllers / socket handlers + DTOs
```

Cross-cutting primitives live in `src/shared/`:

- `Result<T, E>` — explicit success/failure (throwing reserved for *bugs*).
- `AppError` + `ErrorKind` — single error taxonomy mapped to HTTP/WS status.
- `Clock` / `SystemClock` / `FixedClock` — injectable time (deterministic tests).
- `IdGenerator` / `NanoidGenerator` / `SequentialIdGenerator`.
- `createLogger` (pino).

`@gamesphere/shared` (workspace package) holds **branded ids** (`UserId`,
`MatchId`…), the integer **`Money`** type + helpers, and the **domain-event**
contracts shared with the frontend.

**Dependency rule:** `interface → application → domain`; `infrastructure`
implements `domain` ports. Concretions are instantiated only in
`src/composition/build-app.ts` (the composition root) via constructor injection.

---

## 2. Module detail

### 2.1 auth
- `domain/user.ts` — `User { id, username, avatar, rating, createdAt }` (no balance — derived elsewhere).
- Ports: `UserRepository`, `TokenService`, `UserLifecycleListener`.
- Use cases: `LoginOrRegisterUser` (idempotent on the unique `username` index), `GetProfile`.
- Adapters: `MongoUserRepository`, `JwtTokenService`.
- `composeUserLifecycleListeners(...)` fans registration out to wallet (bonus) + leaderboard (seed).

### 2.2 wallet (double-entry ledger)
- `domain/account.ts` — `AccountType` (USER/ESCROW/HOUSE/EXTERNAL), guarded accounts.
- `domain/ledger.ts` — `EntryDirection`, `EntryReason`, `LedgerEntry`.
- `domain/transaction.ts` — `Movements` (pure builders: `externalCredit`, `stake`, `refund`, `settlement`), `isBalanced`, `netDeltas`.
- Port: `WalletRepository { getBalance, commit, listUserEntries }` with `CommitOutcome = committed | duplicate | guard_failed`.
- Adapter: `MongoWalletRepository.commit` runs a multi-doc transaction: insert tx header (unique idempotency key) → apply per-account `$inc` (guarded conditional decrement on USER/ESCROW) → append journal entries.
- Use cases: `CreditFunds`, `HoldEntryFee`, `RefundEntryFee`, `SettleMatch`, `GetWallet`, `SignupBonusGranter`.

### 2.3 game (authoritative engine + realtime)
- `domain/ludo/board.ts` — progress model (0 yard · 1–51 ring · 52–57 home), safe cells, seat offsets.
- `domain/ludo/state.ts` — `GameState` (immutable), `createInitialState`, `nextSeat`.
- `domain/ludo/engine.ts` — pure `legalMoves`, `applyRoll`, `applyMove` returning `Result`.
- Ports: `DiceRoller` / `VerifiableDiceRoller`, `GameGateway`, `TimerScheduler`, plus `MatchGateway` / `SettlementService` / `ActivePlayersReleaser` / `DiceRollerFactory`.
- `application/game-service.ts` — the orchestrator: holds in-memory `GameSession`s, validates intents, runs turn/disconnect timers, triggers settlement.
- Adapters: `ProvablyFairDiceRoller` (HMAC commit-reveal), `SocketGameGateway`, `RealTimerScheduler`; `interface/socket-handler.ts` registers `game:join|roll|move`.

### 2.4 matchmaking
- Port `MatchmakingQueue` (atomic) → `RedisMatchmakingQueue` (Lua `enqueue` / `tryFormPair`).
- `Match` aggregate + `MatchRepository` → `MongoMatchRepository`.
- Use cases: `JoinQueue`, `LeaveQueue`, `GetMatchmakingStatus`, `FormMatch` (saga), `MatchmakingWorker` (tick loop).

### 2.5 leaderboard
- `domain/elo.ts` — pure `applyElo` (K=32, rating floor 100).
- Port `LeaderboardStore` → `RedisLeaderboardStore` (sorted sets, global/daily/weekly).
- `UpdateRatingsOnGameEnded` (event handler), `LeaderboardSeeder` (lifecycle), `GetLeaderboard` (query).

### 2.6 notification / anti-cheat / events
- `SocketNotifier` subscribes to `MATCH_CREATED`, `GAME_ENDED`, `LEADERBOARD_UPDATED` → pushes to user/room.
- `AntiCheatMonitor` subscribes to `GAME_ENDED` → records `PlayerEvent`s, flags abnormal win streaks.
- `RedisEventBus` (publisher + dedicated subscriber connection) implements the `EventBus` port.

---

## 3. Data models (MongoDB)

| Collection | Shape (key fields) |
|---|---|
| `users` | `_id, username (unique), avatar, rating, createdAt` |
| `transactions` | `_id, type, idempotencyKey (unique), metadata, createdAt` |
| `ledgerentries` | `_id, transactionId, accountType, accountRef, direction, reason, amount, createdAt` |
| `balances` | `_id=accountKey, accountType, accountRef, balance, updatedAt` (materialized projection) |
| `matches` | `_id, roomId, players[{userId,seat}], entryFee, pool, status, winnerId, createdAt` |
| `playerevents` | `_id, userId, type, matchId, createdAt` |

All money fields are **integer minor units** (kobo). All `_id`s are app-generated string ids.

---

## 4. Redis keyspace

| Key | Type | Purpose |
|---|---|---|
| `mm:queue:<entryFee>` | ZSET (score=rating) | per-tier matchmaking queue |
| `mm:active` | SET | userIds currently queued or in a match (double-join guard) |
| `lb:global` | ZSET (score=rating) | global ranking |
| `lb:daily:<YYYY-MM-DD>` | ZSET | daily ranking |
| `lb:weekly:<YYYY-Www>` | ZSET | weekly ranking |
| `gamesphere:events` | Pub/Sub channel | domain event fan-out |

---

## 5. Domain events (`@gamesphere/shared`)

`USER_JOINED_QUEUE`, `MATCH_CREATED`, `GAME_STARTED`, `GAME_ENDED`,
`WALLET_UPDATED`, `LEADERBOARD_UPDATED`. Each is `{ type, occurredAt, payload }`
with a typed payload; consumers narrow by `type`.

---

## 6. Key sequences

### 6.1 Stake (atomic, guarded, idempotent)
```
HoldEntryFee.execute(user, match, fee)
  └─ WalletRepository.commit(tx: stake)
       session.withTransaction:
         insert tx header (unique idempotencyKey)         # duplicate → no-op
         balances.updateOne({_id:USER:user, balance>=fee},$inc:-fee)  # 0 matched → guard_failed
         balances.updateOne({_id:ESCROW:match}, $inc:+fee, upsert)
         insert 2 ledger entries
  → committed | duplicate(ok) | guard_failed → INSUFFICIENT_FUNDS
```

### 6.2 Turn (authoritative)
```
client emits game:roll
  GameService.guardTurn(seat == turnSeat, phase == AWAITING_ROLL)
  dice = ProvablyFairDice.roll()             # server-owned
  applyRoll(state, dice) → legalMoves
  broadcast game:rolled + game:state; legalMoves only to current player
client emits game:move {tokenIndex}
  applyMove(state, tokenIndex)  # validated against legalMoves
  winner? → finishGame → SettleMatch (idempotent) → GAME_ENDED
          : broadcast + re-arm turn timer
```

### 6.3 Match formation saga
```
FormMatch(pair, fee)
  hold(p0) fail → release both, re-queue p1
  hold(p1) fail → REFUND p0, release both, re-queue p0
  both ok → persist Match(PENDING), publish MATCH_CREATED
```

---

## 7. Testing strategy

- **Pure domain** (engine rules, Elo, money/rake, movement balance) — fast unit tests.
- **Use cases** against **in-memory adapters** that honor the same contracts as the Mongo/Redis ones (LSP) — e.g. `InMemoryWalletRepository`.
- **Determinism** via `FixedClock`, `SequentialIdGenerator`, seeded `ProvablyFairDiceRoller`, `ManualScheduler`.
- **Integration** against the live replica set (`scripts/verify-wallet.ts`) proving concurrent double-spend prevention, idempotent settlement, and money conservation.
- 45 tests across 10 files at the time of writing.
