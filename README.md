# GameSphere — Real-Money Multiplayer Ludo Backend

A backend-first, production-style **real-money multiplayer Ludo** platform (in
the spirit of *Ludo Naira*), built as an engineering portfolio piece. The focus
is **backend depth** — financial correctness, an authoritative real-time game
loop, matchmaking, rankings, and event-driven architecture — not UI polish.

> **Status:** backend complete (phases P0–P6). 45 tests passing, typecheck +
> lint clean, verified against a live MongoDB replica set and Redis. Frontend
> and production infra (AWS/Prometheus/Grafana/CI) are intentionally deferred.

---

## Why this exists / what it demonstrates

- **Financial integrity for real money** — double-entry ledger, entry-fee
  escrow, idempotent settlement, no-double-spend under concurrency, money
  conservation.
- **Authoritative real-time gameplay** — the server owns the dice and the state;
  clients send only intents. Provably-fair RNG (commit-reveal).
- **Distributed-systems building blocks** — Redis sorted-set matchmaking with
  atomic Lua pairing, Redis Pub/Sub event bus, sorted-set leaderboards.
- **Clean architecture** — modular monolith, ports & adapters, strict SOLID,
  manual dependency injection, exhaustive typing.

See **[docs/HLD.md](docs/HLD.md)**, **[docs/LLD.md](docs/LLD.md)**, and
**[docs/DESIGN_DECISIONS.md](docs/DESIGN_DECISIONS.md)** for the deep dive.

---

## Tech stack

**Runtime:** Node 20+, TypeScript (strict) · **HTTP:** Express · **Realtime:**
Socket.IO · **DB:** MongoDB (Mongoose, replica set for transactions) ·
**Cache/queues/bus:** Redis (ioredis) · **Validation:** Zod · **Auth:** JWT ·
**Logging:** pino · **Tests:** Vitest · **Tooling:** pnpm workspaces, ESLint,
Prettier, `tsx`.

---

## Repository layout

```
multiplayer-game/
├─ docs/                     HLD, LLD, design decisions, PRD
├─ docker-compose.dev.yml    dev Mongo (replica set) + Redis
├─ packages/
│  └─ shared/                branded ids, Money, domain-event contracts
└─ apps/
   └─ api/
      ├─ src/
      │  ├─ main.ts           entrypoint
      │  ├─ composition/      build-app.ts — the composition root (all wiring)
      │  ├─ config/           zod-validated env
      │  ├─ shared/           Result, AppError, Clock, IdGenerator, logger
      │  ├─ infrastructure/   mongo, redis, http (express), ws (socket.io)
      │  └─ modules/          auth · wallet · game · matchmaking ·
      │                       leaderboard · notification · anticheat · events
      ├─ test/                vitest unit/integration + in-memory test doubles
      └─ scripts/             verify-wallet.ts (live integrity check)
```

Each module is layered `domain/ · application/ · infrastructure/ · interface/`.

---

## Getting started

### Prerequisites
- Node 20+ and **pnpm** (`npm i -g pnpm`)
- Docker (for local Mongo + Redis)

### 1. Install
```bash
pnpm install
```

### 2. Start dev infrastructure
```bash
pnpm dev:infra        # docker compose up -d  (Mongo replica set + Redis)
```
> Mongo runs as a single-node replica set so multi-document transactions work.
> Redis is mapped to host port **6380** to avoid clashing with other local Redis.

### 3. Configure env
```bash
cp .env.example apps/api/.env   # sensible local defaults already filled in
```

### 4. Run the API
```bash
pnpm dev:api          # tsx watch — http://localhost:4000
```

### 5. Quality gates
```bash
pnpm -r typecheck     # strict tsc, no emit
pnpm test             # vitest (45 tests)
pnpm lint             # eslint
```

### 6. Prove the money handling (against live Mongo)
```bash
pnpm --filter @gamesphere/api exec tsx scripts/verify-wallet.ts
```
Asserts: concurrent double-spend prevention, idempotent settlement, and
Σ(all account balances) === 0.

---

## HTTP API

All under `/api`; authenticated routes need `Authorization: Bearer <jwt>`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | – | Liveness probe |
| `POST` | `/api/auth/login` | – | Login or register by username → `{ token, user }` |
| `GET` | `/api/users/me` | ✓ | Current user profile |
| `GET` | `/api/wallet` | ✓ | Balance + recent ledger entries |
| `POST` | `/api/wallet/deposit` | ✓ | `{ amount, reference? }` (reference ⇒ idempotent) |
| `POST` | `/api/matchmaking/join` | ✓ | `{ entryFee }` — enter a cash-table queue |
| `POST` | `/api/matchmaking/leave` | ✓ | `{ entryFee }` |
| `GET` | `/api/matchmaking/status` | ✓ | `{ state, match, queuedTiers }` |
| `GET` | `/api/leaderboard` | – | `?scope=global\|daily\|weekly&limit=10` |

Entry-fee tiers (minor units): `10000`, `50000`, `100000` (₦100 / ₦500 / ₦1,000).
New users receive a ₦500 signup bonus.

---

## WebSocket protocol (Socket.IO)

Connect with `auth: { token }`. The server pins each socket to a `user:<id>`
room on connect.

**Client → server**
| Event | Payload | Notes |
|---|---|---|
| `game:join` | `{ matchId }` | Join the match room; starts the game when both players are present |
| `game:roll` | `{ matchId }` | Request a server-authoritative roll (must be your turn) |
| `game:move` | `{ matchId, tokenIndex }` | Move a token (validated against legal moves) |

**Server → client**
| Event | Payload |
|---|---|
| `game:started` | `{ matchId, diceCommitment }` |
| `game:state` | full board snapshot |
| `game:rolled` | `{ seat, dice, turnPassed, reason }` |
| `game:legalMoves` | `{ matchId, moves }` (only to the player on turn) |
| `game:ended` | `{ winnerId, winnings, rake, dice: { commitment, serverSeed, rolls } }` |
| `game:error` | `{ code, message }` |
| `notify` | `{ type, ... }` — match found / game ended / rank changed |

---

## Game rules (v1)

2-player cash tables, classic Ludo (first to bring all four tokens home wins).
Server-enforced per-turn timeout (auto-plays a stalling player) and a disconnect
grace period (vanished player forfeits). Captures on non-safe cells; extra turn
on a six / capture / finishing a token; triple-six forfeits the turn.

---

## Roadmap

- **Done — P0–P6:** scaffold, auth, wallet/ledger, Ludo engine + provably-fair
  dice, matchmaking, realtime game + settlement, leaderboard/events/
  notifications/anti-cheat.
- **P7 (next):** minimal Next.js frontend to visualize the backend (login,
  lobby, match room, wallet, leaderboard, ops dashboard).
- **P8 (later):** Prometheus/Grafana metrics, Nginx, AWS EC2 + Docker Compose,
  GitHub Actions CI/CD.

---

## License

Portfolio / educational project.
