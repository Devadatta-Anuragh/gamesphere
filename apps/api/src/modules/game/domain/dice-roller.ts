/**
 * Port for the authoritative dice. The client NEVER rolls — for a real-money
 * game that would be the most obvious cheat vector. The server owns the RNG and
 * the engine simply consumes the value, so dice generation can be swapped
 * (provably-fair, scripted-for-tests, ...) without touching game logic.
 */
export interface DiceRoller {
  /** Returns the next dice value in 1..6. */
  roll(): number;
}

/**
 * A dice source whose every roll can be independently verified after the match.
 * The server publishes `commitment()` (a hash of a secret seed) before play and
 * `reveal()`s the seed afterwards, so any party can recompute every roll and
 * confirm the server did not manipulate them.
 */
export interface VerifiableDiceRoller extends DiceRoller {
  /** Hash of the secret server seed, published before the first roll. */
  commitment(): string;
  /** Number of rolls produced so far. */
  nonce(): number;
  /** The secret seed, disclosed only after the match ends. */
  reveal(): string;
}
