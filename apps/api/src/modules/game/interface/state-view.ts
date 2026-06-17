import { legalMoves, type LegalMove } from '../domain/ludo/engine.js';
import type { GameSession } from '../domain/game-session.js';

/** Public, serializable snapshot broadcast to every player in a match. */
export interface GameStateView {
  matchId: string;
  status: string;
  phase: string;
  turnSeat: number;
  lastRoll: number | null;
  winner: number | null;
  pool: number;
  seats: {
    seat: number;
    userId: string;
    username: string;
    connected: boolean;
    tokens: number[];
  }[];
  startOffset: Record<number, number>;
  diceCommitment: string;
}

export const toStateView = (session: GameSession): GameStateView => ({
  matchId: session.matchId,
  status: session.status,
  phase: session.state.phase,
  turnSeat: session.state.turnSeat,
  lastRoll: session.state.lastRoll,
  winner: session.state.winner,
  pool: session.pool,
  seats: session.seats.map((s) => ({
    seat: s.seat,
    userId: s.userId,
    username: s.username,
    connected: session.connected.has(s.seat),
    tokens: [...(session.state.tokens[s.seat] ?? [])],
  })),
  startOffset: { ...session.state.startOffset },
  diceCommitment: session.dice.commitment(),
});

/** Legal moves are sent only to the player whose turn it is. */
export const legalMovesFor = (session: GameSession): LegalMove[] =>
  session.state.lastRoll === null
    ? []
    : legalMoves(session.state, session.state.lastRoll);
