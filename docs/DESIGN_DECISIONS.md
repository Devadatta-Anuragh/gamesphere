# GameSphere — Design Decisions & Tradeoffs

Each entry: **decision · why · tradeoff · alternative**. This is the file to
read before discussing the system in an interview.

---

## 1. Double-entry ledger; balance is derived, not stored
**Decision.** Every money movement is a balanced set of entries transferring
value between accounts (`USER`, `ESCROW`, `HOUSE`, `EXTERNAL`). The immutable
journal is the source of truth; a `balances` document is a *materialized
projection*.
**Why.** It's how real financial systems work: a complete, append-only audit
trail, no destructive balance mutation, and a system-wide invariant (Σ balances
= 0) you can assert. Entry fees, rake, winnings, refunds all become first-class
ledger facts.
**Tradeoff.** More writes per operation and a projection to keep consistent.
**How resolved.** The projection is updated inside the *same* MongoDB
transaction as the journal entries, so they can never diverge — and the
projection doubles as the concurrency-control point (next item).
**Alternative.** A single mutable `balance` column — simpler, but no audit
trail and prone to silent drift; unacceptable for real money.

## 2. Materialized balance as the double-spend guard
**Decision.** Guarded debits use a conditional update
`updateOne({_id, balance: {$gte: amount}}, {$inc: {balance: -amount}})`.
**Why.** MongoDB transactions give snapshot isolation but *not* automatic
protection against write-skew on a recomputed sum — two concurrent stakes could
both read "enough balance" and both commit. Making the balance document the
single contended write serializes competing debits (one wins, the other sees
`matchedCount === 0` → `INSUFFICIENT_FUNDS`).
**Verified.** `scripts/verify-wallet.ts`: 20 concurrent stakes against a balance
that affords 10 → exactly 10 succeed, balance lands at 0, never negative.
**Alternative.** Per-user Redis lock (works, adds a moving part) or summing the
ledger inside the transaction (vulnerable to write-skew).

## 3. Idempotency keys on every mutating money op
**Decision.** Deposits, stakes (`stake:<match>:<user>`), refunds, payouts
(`settle:<match>`) all carry a deterministic idempotency key with a unique index.
**Why.** Networks retry and events can be redelivered. A duplicated
`GAME_ENDED` or a retried match-join must never pay twice or double-charge.
**Verified.** 3 concurrent settlement calls → winner paid once, escrow drained
once.

## 4. Server-authoritative, provably-fair dice
**Decision.** The client never rolls. The server uses
`HMAC(serverSeed, nonce)` with rejection sampling, publishes `sha256(serverSeed)`
before play, and reveals the seed at the end.
**Why.** In a real-money game, client-side RNG is the most obvious cheat. Commit-
reveal lets players verify *after the fact* that the house didn't manipulate
rolls — trust without trusting.
**Tradeoff.** Slightly more ceremony than `Math.random()`; modulo bias must be
handled (done via rejection sampling).

## 5. Pure, framework-free game engine
**Decision.** The Ludo rules (`legalMoves`/`applyRoll`/`applyMove`) are pure
functions over an immutable `GameState`; the dice value is *passed in*.
**Why.** Determinism and testability. The engine has zero I/O, so it's trivially
unit-tested (25 randomized full games proving termination) and the same code can
power replays or bots.
**Tradeoff.** The orchestration (timers, sockets, persistence) lives separately
in `GameService` — more files, but a clean seam between rules and runtime.

## 6. In-memory authoritative game state
**Decision.** Live `GameSession`s are held in memory on the instance that owns
the match.
**Why.** Lowest latency and the simplest correct design for the turn loop and
timers; a single owner means no distributed locking on game state.
**Tradeoff.** A given match is pinned to one instance; that instance crashing
loses in-progress (unsettled) games.
**Path to scale.** Sticky sessions (route a match's sockets to its owner) or move
session state into Redis with the Socket.IO Redis adapter. Money is safe
regardless — stakes are already escrowed, and settlement is idempotent.

## 7. Atomic matchmaking via Lua
**Decision.** Enqueue and pair are Lua scripts over a per-tier sorted set + an
`mm:active` set.
**Why.** Redis runs a script to completion without interleaving, so multiple
matchmaking workers (horizontal scale) can never pull the same player into two
matches, and double-join is rejected atomically — no application-level locks.

## 8. Match formation as a compensating saga
**Decision.** Two entry fees are escrowed in sequence; if the second fails, the
first is refunded and the solvent player is re-queued.
**Why.** The two stakes aren't a single ACID transaction (different users,
separate commits), so the cross-aggregate operation needs a saga with explicit
compensation rather than pretending it's atomic.
**Result.** A match never exists with an unfunded pool.

## 9. Event-driven cross-module reactions (Redis Pub/Sub)
**Decision.** Modules publish domain events; leaderboard, notifications, and
anti-cheat subscribe. Transport is Redis Pub/Sub.
**Why.** Loose coupling — the game service doesn't know the leaderboard exists —
and cross-instance fan-out.
**Tradeoff.** Pub/Sub is at-most-once (fire-and-forget). Lost events would mean a
missed rank update, *not* lost money: settlement happens inline in the game
service, never via an event.
**Path to durability.** Redis Streams or a transactional outbox if a consumer's
side-effect ever becomes business-critical.

## 10. Manual DI via a composition root (no framework)
**Decision.** All wiring lives in `build-app.ts`; dependencies are constructor-
injected interfaces. No tsyringe/InversifyJS.
**Why.** The dependency graph is explicit and greppable, there's no decorator
magic to explain, and it's the clearest demonstration of DIP. Swapping a Mongo
repo for an in-memory one (tests) is a one-line change in one file.
**Tradeoff.** The root file grows; acceptable and still readable for this size.

## 11. Modular monolith over microservices
**Decision.** One deployable with strong internal module boundaries.
**Why.** All the distributed-systems concepts (queues, pub/sub, caching, atomic
ops, idempotency) are demonstrated without the operational cost of many
services. Boundaries are drawn (ports + events) so a module *could* be extracted
later.
**Tradeoff.** Shared process/runtime; not independently deployable yet.

## 12. MongoDB (replica set) over PostgreSQL
**Decision.** MongoDB, run as a single-node replica set in dev.
**Why.** Flexible documents speed up prototyping of game/match/event shapes, and
multi-document transactions (needed for the ledger) require a replica set.
**Tradeoff.** Postgres would give stronger relational constraints for a ledger;
Mongo transactions + a unique idempotency index + the balance guard cover the
integrity needs here.

## 13. Integer minor units + basis-point rake
**Decision.** Money is integer kobo; rake is basis points (`Math.floor`).
**Why.** Floating-point money is a classic bug source (`0.1 + 0.2 !== 0.3`).
Integers + floored rake mean the house never over-collects and totals always
reconcile.

## 14. `tsx` runtime, no build step (yet)
**Decision.** Dev and run via `tsx`; `tsc --noEmit` for typechecking only.
**Why.** Fast iteration, no ESM/extension friction. Strict TS
(`noUncheckedIndexedAccess`, `verbatimModuleSyntax`, etc.) still enforces rigor.
**Tradeoff.** A production image would add a bundle/emit step (`tsup`); deferred
to the infra phase.

## 15. pino over winston (deviation from PRD)
**Decision.** Structured logging with pino + per-request ids.
**Why.** Faster, JSON-native, ergonomic child loggers for tracing. A deliberate,
flagged deviation from the PRD's winston/morgan.
