# GameSphere — High-Level Design (HLD)

> Real-money multiplayer **Ludo** backend (in the spirit of *Ludo Naira*), built
> as a backend-engineering portfolio piece. The objective is production-grade
> backend depth, not a polished game UI.

---

## 1. System overview

GameSphere lets players join skill-rated **cash tables**, get matched, play an
authoritative game of Ludo over WebSockets for real stakes, and have the prize
pool settled through a double-entry ledger. Rankings, notifications, and basic
anti-cheat all react to game events.

The whole API is a **modular monolith** written in TypeScript. It can be scaled
horizontally; the only stateful caveat is live game sessions (see §6).

```
                         ┌─────────────────────────────┐
        HTTP / WS        │          API (Node)         │
  client ───────────────▶│  Express  +  Socket.IO      │
                         │                             │
                         │  modules (ports & adapters) │
                         │  auth · wallet · matchmaking│
                         │  game · leaderboard ·       │
                         │  notification · anti-cheat  │
                         └───────┬───────────┬─────────┘
                                 │           │
                      ┌──────────▼──┐   ┌────▼─────────┐
                      │   MongoDB    │   │    Redis     │
                      │ users,       │   │ matchmaking  │
                      │ ledger,      │   │ queues,      │
                      │ matches,     │   │ leaderboard  │
                      │ player events│   │ ZSETs,       │
                      │              │   │ Pub/Sub bus  │
                      └──────────────┘   └──────────────┘
```

---

## 2. Core domains (bounded contexts)

| Module | Responsibility |
|---|---|
| **auth** | Lightweight username login, JWT issuance, user/rating aggregate |
| **wallet** | Double-entry ledger, entry-fee escrow, idempotent settlement, balances |
| **matchmaking** | Redis skill queues, atomic pairing, match formation saga, match records |
| **game** | Authoritative Ludo engine, provably-fair dice, turn timers, settlement trigger |
| **leaderboard** | Elo ratings, Redis sorted-set rankings (global/daily/weekly) |
| **notification** | Pushes domain events to clients over WebSockets |
| **anti-cheat** | Player-event journal + abnormal-streak detection |
| **events** | The event bus (Redis Pub/Sub) every module publishes to / reacts from |

Modules never call each other's internals — they communicate through **narrow
ports** (interfaces) wired in a single composition root, and via **domain
events** for cross-cutting reactions.

---

## 3. Key flows

### 3.1 Join → match
1. `POST /matchmaking/join` validates the entry-fee tier and the player's balance, then atomically enqueues them in a Redis sorted set (scored by rating).
2. A background **matchmaking worker** pops the two closest-rated players atomically (Lua).
3. **FormMatch** escrows both entry fees (a saga with refund compensation if one can't pay), persists the `Match`, and publishes `MATCH_CREATED`.
4. The notifier pushes `match_found` to both players.

### 3.2 Play (authoritative real-time loop)
1. Each player connects a socket and emits `game:join`; when both are present the game starts (`GAME_STARTED`).
2. The **server** rolls the dice (provably-fair), validates every move against the engine's legal moves, and broadcasts the new state. The client only sends *intents* (`roll`, `move`).
3. A per-turn timer auto-plays for a stalling player; a disconnect grace timer forfeits a vanished one.

### 3.3 End → settle
1. When a player wins (or an opponent forfeits), the game service triggers **idempotent settlement**: the escrow pool is split into winnings (pool − rake) and house rake in one atomic transaction.
2. `GAME_ENDED` is published → leaderboard updates Elo ratings, anti-cheat logs the result, the dice seed is revealed for verification.

---

## 4. Real-money integrity (the headline)

- **Double-entry ledger** — every money movement is a balanced transfer between accounts (`USER`, `ESCROW`, `HOUSE`, `EXTERNAL`); the sum of all balances is invariably 0.
- **Balance is derived, never trusted** — the immutable journal is the source of truth; a materialized balance is updated in the *same* DB transaction and serves as the contention point that prevents double-spend.
- **Idempotency everywhere** — deposits, stakes, refunds, and payouts carry idempotency keys, so retries and duplicate events can never double-charge or double-pay.
- **Provably-fair dice** — the server commits `sha256(seed)` before play and reveals the seed afterward; any roll can be recomputed and verified.

See [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) for the *why* behind each.

---

## 5. Non-functional targets

| Concern | Approach |
|---|---|
| Latency (<100ms updates) | In-memory authoritative state + Socket.IO room fan-out |
| Throughput / scale | Stateless HTTP, atomic Redis ops, sorted-set leaderboards |
| Consistency (money) | MongoDB multi-document transactions on a replica set |
| Availability | Stateless API replicas behind a load balancer (infra phase) |
| Security | JWT auth, Helmet, CORS, rate limiting, server-side validation (Zod) |
| Observability | Structured logging (pino) with per-request ids; metrics endpoint (infra phase) |

---

## 6. Scaling model & known tradeoffs

- **HTTP / matchmaking / wallet / leaderboard** scale horizontally — all shared state lives in Mongo/Redis and all contended operations are atomic.
- **Live game sessions are in-memory** on the instance that owns the match (simplest correct design for a demo). To scale the realtime layer: use **sticky sessions** (route a match's sockets to one instance) or move session state into **Redis** with the Socket.IO Redis adapter for cross-instance broadcast.
- **Event bus is Redis Pub/Sub** → at-most-once, fire-and-forget. For guaranteed delivery (e.g. financial side-effects that must not be lost) switch to **Redis Streams** or an outbox pattern. Settlement itself does *not* depend on event delivery — it happens inline in the game service.

---

## 7. Deployment topology (deferred infra phase)

Single AWS EC2 host running Docker Compose: `nginx` → `api` (×N) + `frontend`,
with `mongo`, `redis`, `prometheus`, `grafana`. CI/CD via GitHub Actions
(build images → SSH → compose up). Local development uses
`docker-compose.dev.yml` (Mongo single-node replica set + Redis) with the API
run via `tsx`.
